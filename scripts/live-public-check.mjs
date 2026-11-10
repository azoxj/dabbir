// فحوص حية على مشروع Supabase الحقيقي باستخدام القيم العامة فقط (من .env.production) — بدون تسجيل حسابات وبدون كتابة بيانات.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const env = Object.fromEntries(readFileSync(fileURLToPath(new URL('../.env.production', import.meta.url)), 'utf8')
  .split('\n').filter((l) => l.startsWith('VITE_')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', name, e.message]) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const h = { apikey: KEY }

await check('auth: email sign-in enabled and email confirmation required', async () => {
  const s = await (await fetch(`${URL_}/auth/v1/settings`, { headers: h })).json()
  assert(s.external?.email === true, `email provider: ${JSON.stringify(s.external?.email)}`)
  assert(s.mailer_autoconfirm === false, `mailer_autoconfirm=${s.mailer_autoconfirm}`)
  assert(s.disable_signup === false, 'signup disabled')
})

for (const table of ['profiles', 'expenses', 'budget_limits', 'commitments', 'savings_goals', 'legacy_v2_imports']) {
  await check(`anon cannot read ${table}`, async () => {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, { headers: h })
    const body = await r.text()
    assert(r.status === 401 || r.status === 403 || (r.ok && body === '[]'), `${r.status} ${body.slice(0, 120)}`)
  })
}

await check('anon cannot call reset_my_data / adjust_goal_amount', async () => {
  for (const [fn, args] of [['reset_my_data', {}], ['adjust_goal_amount', { p_goal_id: '00000000-0000-0000-0000-000000000000', p_delta: 1 }]]) {
    const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify(args) })
    assert(r.status === 401 || r.status === 403, `${fn}: ${r.status}`)
  }
})

await check('forged user JWT is rejected', async () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const forged = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated', aud: 'authenticated', exp: 4900000000 })}.${Buffer.from('nope').toString('base64url')}`
  const r = await fetch(`${URL_}/rest/v1/expenses?select=*`, { headers: { ...h, Authorization: `Bearer ${forged}` } })
  assert(r.status === 401, `status ${r.status}`)
})

await check('requests without an API key are refused', async () => {
  const r = await fetch(`${URL_}/rest/v1/expenses?select=*`)
  assert(r.status === 401, `status ${r.status}`)
})

await check('anon cannot write', async () => {
  const r = await fetch(`${URL_}/rest/v1/expenses`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ amount: 1, category: 'food' }) })
  assert(r.status === 401 || r.status === 403, `status ${r.status}`)
})

for (const r of results) console.log(r.join('  '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed against ${URL_}`)
process.exit(failed ? 1 : 0)
