// Supabase Edge Function. Public GET exposes only VAPID public key.
// POST is reserved for the server-side scheduler with a service-role bearer token.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,content-type' }
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
const env = (name: string) => Deno.env.get(name) ?? ''
async function authorized(request: Request): Promise<boolean> {
  const bearer = request.headers.get('authorization') ?? ''
  if (!bearer.startsWith('Bearer ')) return false
  const token = bearer.slice(7)
  if (!token || !env('SUPABASE_SERVICE_ROLE_KEY')) return false
  // The scheduler key is stored in Vault. Check equality server-side using a
  // service-role-only RPC rather than assuming Supabase's injected key matches
  // the project's legacy service_role JWT.
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const { data, error } = await sb.rpc('verify_dabbir_push_scheduler_token', { candidate: token })
  return !error && data === true
}
function todayRiyadh(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function daysUntil(day: string, target: string): number {
  return Math.round((Date.parse(target + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 86400000)
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  const publicKey = env('VAPID_PUBLIC_KEY'), privateKey = env('VAPID_PRIVATE_KEY')
  if (request.method === 'GET') return publicKey ? respond({ publicKey, ready: Boolean(privateKey && env('VAPID_SUBJECT')), missing: [!privateKey && 'VAPID_PRIVATE_KEY', !env('VAPID_SUBJECT') && 'VAPID_SUBJECT'].filter(Boolean) }) : respond({ error: 'push_not_configured', missing: ['VAPID_PUBLIC_KEY'] }, 503)
  if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405)
  if (!await authorized(request)) return respond({ error: 'unauthorized' }, 401)
  if (!publicKey || !privateKey || !env('VAPID_SUBJECT')) return respond({ error: 'push_not_configured' }, 503)
  const subjectRaw = env('VAPID_SUBJECT').trim()
  const subject = subjectRaw.includes('://') || subjectRaw.startsWith('mailto:') ? subjectRaw : 'mailto:' + subjectRaw
  webpush.setVapidDetails(subject, publicKey, privateKey)
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const day = todayRiyadh()
  // Page through subscriptions, with an explicit cap to avoid unbounded invocation costs.
  let sent = 0, failed = 0, skipped = 0, examined = 0
  for (let page = 0; page < 20; page++) {
    const { data: subscriptions, error } = await sb.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').order('id').range(page * 100, page * 100 + 99)
    if (error) return respond({ error: 'subscriptions_query_failed' }, 500)
    if (!subscriptions?.length) break
    for (const sub of subscriptions) {
      examined++
      const [{ data: profile }, { data: commitments }, { data: goals }] = await Promise.all([
        sb.from('profiles').select('alert_days').eq('id', sub.user_id).maybeSingle(),
        sb.from('commitments').select('due_date').eq('user_id', sub.user_id).eq('done', false).gte('due_date', day).limit(100),
        sb.from('savings_goals').select('target_date,target_amount,current_amount').eq('user_id', sub.user_id).not('target_date', 'is', null).gte('target_date', day).limit(100),
      ])
      const alertDays = Math.min(14, Math.max(1, Number(profile?.alert_days ?? 3)))
      const hasCommitment = commitments?.some((c) => daysUntil(day, c.due_date) <= alertDays) ?? false
      const hasGoal = goals?.some((g) => Number(g.current_amount) < Number(g.target_amount) && daysUntil(day, g.target_date) <= alertDays) ?? false
      if (!hasCommitment && !hasGoal) { skipped++; continue }
      const reminderKey = 'daily:' + day
      const { error: claimError } = await sb.from('push_delivery_log').insert({ subscription_id: sub.id, reminder_key: reminderKey, delivery_day: day })
      if (claimError) { skipped++; continue } // already claimed by this or a concurrent run
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ type: 'dabbir-reminder' }), { TTL: 3600, urgency: 'normal' })
        sent++
      } catch (e) {
        failed++
        console.error('dabbir push delivery failed', { statusCode: (e as { statusCode?: number }).statusCode ?? null, message: e instanceof Error ? e.message.slice(0, 240) : 'unknown' })
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await sb.from('push_subscriptions').delete().eq('id', sub.id)
        else await sb.from('push_delivery_log').delete().eq('subscription_id', sub.id).eq('reminder_key', reminderKey).eq('delivery_day', day)
      }
    }
    if (subscriptions.length < 100) break
  }
  return respond({ sent, failed, skipped, examined, day })
})
