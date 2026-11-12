import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const envPath = fileURLToPath(new URL('../../supabase/local/.env', import.meta.url))
export const env = Object.fromEntries(readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) as Record<string, string>
export const URL_ = env.VITE_SUPABASE_URL!
export const ANON = env.VITE_SUPABASE_ANON_KEY!
const MAIL = 'http://127.0.0.1:54324'

/** عميل مستقل يمثل «جهازًا» مختلفًا (تخزين جلسة في الذاكرة). */
export function device(): SupabaseClient {
  const store = new Map<string, string>()
  return createClient(URL_, ANON, {
    auth: {
      persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) },
    },
  })
}

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
export const PASSWORD = 'Test1234pass'

interface MailSummary { ID: string; To: { Address: string }[]; Subject: string; Created: string }

/** ينتظر رسالة بريد لعنوان معين في Mailpit ويعيد أول رابط verify فيها. */
export async function waitForMailLink(to: string, opts: { after?: number; contains?: string } = {}): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const { messages } = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json() as { messages: MailSummary[] }
    const fresh = messages.filter((m) => !opts.after || Date.parse(m.Created) >= opts.after)
    for (const m of fresh) {
      const body = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json() as { Text: string; HTML: string }
      const links = (body.Text + ' ' + body.HTML).match(/https?:\/\/[^\s"'<>]+verify[^\s"'<>]*/g) ?? []
      const link = links.map((l) => l.replace(/&amp;/g, '&')).find((l) => !opts.contains || l.includes(opts.contains))
      if (link) return link
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no mail for ${to}`)
}

/** يتبع رابط التأكيد/الاستعادة ويعيد معاملات الـ fragment التي يُعاد بها المستخدم للتطبيق. */
export async function followVerifyLink(link: string): Promise<{ location: string; params: URLSearchParams }> {
  const res = await fetch(link, { redirect: 'manual' })
  const location = res.headers.get('location') ?? ''
  return { location, params: new URLSearchParams(location.split('#')[1] ?? '') }
}

/** إنشاء مستخدم مؤكد بالبريد عبر نفس مسار التسجيل الحقيقي (بدون service_role). */
export async function confirmedUser(tag: string) {
  const email = uniqueEmail(tag)
  const sb = device()
  const { error } = await sb.auth.signUp({ email, password: PASSWORD, options: { data: { full_name: tag } } })
  if (error) throw error
  await followVerifyLink(await waitForMailLink(email))
  const { data, error: e2 } = await sb.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw e2
  return { email, sb, id: data.user.id }
}
