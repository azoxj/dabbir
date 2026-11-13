// اختبار متصفح حقيقي (Chromium) للتطبيق مربوطًا بـ Supabase محلي حقيقي (GoTrue + PostgREST + Postgres + Mailpit).
// المتطلبات: npm run supabase:start && npm run build:local
// يُخدم التطبيق تحت /dabbir/ بخادم يحاكي GitHub Pages. لا بيانات حقيقية: كل الحسابات @example.test.
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { startPagesServer } from './pages-server.mjs'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const shots = `${root}tests/e2e/screenshots/supabase`
await mkdir(shots, { recursive: true })
const BASE = 'http://localhost:4180/dabbir/'
const MAIL = 'http://127.0.0.1:54324'
const API = 'http://localhost:54321'
const PASSWORD = 'Test1234pass'
const NEW_PASSWORD = 'Changed5678pass'
const ANON = readFileSync(`${root}supabase/local/.env`, 'utf8').match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)[1]
const stamp = Date.now()
const EMAIL_A = `e2e-a-${stamp}@example.test`
const EMAIL_B = `e2e-b-${stamp}@example.test`

const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

async function mailLink(to, after) {
  for (let i = 0; i < 40; i++) {
    const { messages } = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()
    for (const m of messages.filter((x) => Date.parse(x.Created) >= after)) {
      const body = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()
      const link = (body.Text.match(/https?:\/\/\S+verify\S+/) ?? [])[0]
      if (link) return link
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no email for ${to}`)
}

const server = await startPagesServer({ root: `${root}dist-supabase`, base: '/dabbir/', port: 4180 })
const browser = await chromium.launch()
try {
  const ctx1 = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-SA', timezoneId: 'Asia/Riyadh' })
  const p1 = await ctx1.newPage()
  const errors = []
  p1.on('pageerror', (e) => errors.push(e.message))
  const failed = []
  p1.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(API)) failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '').split('?')[0]}`) })
  p1.on('console', (m) => m.type() === 'error' && !/404 \(Not Found\)|status of 400|status of 429/.test(m.text()) && errors.push(m.text()))
  const nav = (p, name) => p.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name, exact: true })
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  await check('real-mode login page: demo entry removed', async () => {
    await p1.goto(BASE)
    await p1.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
    assert(await p1.getByTestId('demo-banner').count() === 0, 'demo banner shown in real mode')
    assert(await p1.getByRole('button', { name: 'جرّب بدون حساب (وضع تجريبي محلي)' }).count() === 0, 'demo entry still visible')
  })

  let signupAt
  await check('register → «تحقق من بريدك»', async () => {
    await p1.getByRole('link', { name: 'أنشئ حساب' }).click()
    await p1.getByLabel('الاسم (اختياري)').fill('سارة')
    await p1.getByLabel('البريد الإلكتروني').fill(EMAIL_A)
    await p1.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD)
    await p1.getByLabel('تأكيد كلمة المرور').fill(PASSWORD)
    signupAt = Date.now() - 1000
    await p1.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await p1.getByRole('heading', { name: 'تحقق من بريدك' }).waitFor()
  })

  await check('login before confirming → Arabic error + resend button (rate-limited message on immediate resend)', async () => {
    await p1.getByRole('link', { name: 'الرجوع لتسجيل الدخول' }).click()
    await p1.getByLabel('البريد الإلكتروني').fill(EMAIL_A)
    await p1.getByLabel('كلمة المرور').fill(PASSWORD)
    await p1.getByRole('button', { name: 'دخول' }).click()
    await p1.getByText('لازم تأكد بريدك أولًا').waitFor()
    await p1.getByRole('button', { name: 'إعادة إرسال رسالة التأكيد' }).click()
    await p1.getByText('لأمانك، ما نقدر نرسل رسالة جديدة').waitFor()
  })

  await check('confirmation email link signs the user in on the dashboard', async () => {
    await p1.goto(await mailLink(EMAIL_A, signupAt))
    await p1.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor({ timeout: 15000 })
    await p1.getByText(/سارة/).first().waitFor()
    assert(!p1.url().includes('access_token'), 'token left in URL')
  })

  await check('reusing the confirmation link shows the expired-link message', async () => {
    const page = await (await browser.newContext()).newPage()
    await page.goto(await mailLink(EMAIL_A, signupAt))
    await page.getByText('الرابط منتهي الصلاحية أو مستخدم من قبل').waitFor()
    assert(!page.url().includes('error_code'), 'error left in URL')
    await page.context().close()
  })

  await check('save income, fixed cost, expense (edit + delete), commitment, goal, preferences', async () => {
    await nav(p1, 'الميزانية').click()
    await p1.getByLabel('الدخل الشهري (ر.س)').fill('9000')
    await p1.getByLabel('هدف الادخار الشهري').fill('1000')
    await p1.getByRole('button', { name: 'حفظ', exact: true }).click()
    await p1.getByText('تم حفظ إعدادات الدخل ✓').waitFor()

    await p1.getByRole('button', { name: '+ تكلفة ثابتة' }).click()
    await p1.getByLabel('اسم التكلفة').fill('الإيجار')
    await p1.getByLabel('المبلغ الشهري').fill('2500')
    await p1.getByLabel('يوم الاستحقاق').fill('27')
    await p1.getByRole('button', { name: 'إضافة', exact: true }).click()
    await p1.getByTestId('fixed-costs').getByText('الإيجار').waitFor()

    for (const [amount, note] of [['٤٥', 'غداء'], ['120', 'للحذف']]) {
      await p1.getByLabel('المبلغ (ر.س)').fill(amount)
      await p1.getByLabel('ملاحظة (اختياري)').fill(note)
      await p1.getByRole('button', { name: 'إضافة المصروف' }).click()
      await p1.getByTestId('expense-list').getByText(note).waitFor()
    }
    await p1.getByRole('button', { name: 'تعديل غداء' }).click()
    const form = p1.getByRole('form', { name: 'تعديل غداء' })
    await form.getByLabel('المبلغ').fill('55')
    await form.getByLabel('الملاحظة').fill('غداء عمل')
    await form.getByRole('button', { name: 'حفظ التعديل' }).click()
    await p1.getByTestId('expense-list').getByText('غداء عمل').waitFor()
    p1.once('dialog', (d) => d.accept())
    await p1.getByRole('button', { name: 'حذف للحذف' }).click()
    await p1.getByTestId('expense-list').getByText('للحذف').waitFor({ state: 'detached' })

    await nav(p1, 'الالتزامات').click()
    await p1.getByRole('button', { name: '+ إضافة التزام أو موعد' }).click()
    await p1.getByLabel('الاسم').fill('تجديد الاستمارة')
    await p1.getByLabel('المبلغ (اختياري)').fill('150')
    await p1.getByRole('button', { name: 'حفظ', exact: true }).click()
    await p1.getByTestId('commitment-list').getByText('تجديد الاستمارة').waitFor()
    await p1.getByRole('button', { name: 'تعديل تجديد الاستمارة' }).click()
    await p1.getByLabel('الاسم').fill('تجديد استمارة السيارة')
    await p1.getByRole('button', { name: 'حفظ التعديل' }).click()
    await p1.getByTestId('commitment-list').getByText('تجديد استمارة السيارة').waitFor()

    await nav(p1, 'الأهداف').click()
    await p1.getByRole('button', { name: '+ هدف ادخار جديد' }).click()
    await p1.getByLabel('اسم الهدف').fill('صندوق الطوارئ')
    await p1.getByLabel('المبلغ المستهدف').fill('20000')
    await p1.getByRole('button', { name: 'حفظ الهدف' }).click()
    const card = p1.getByRole('region', { name: 'هدف صندوق الطوارئ' })
    await card.getByLabel('المبلغ').fill('5000')
    await card.getByRole('button', { name: 'إيداع' }).click()
    await card.locator('[role=progressbar][aria-valuenow="25"]').waitFor()

    await nav(p1, 'حسابي').click()
    await p1.getByLabel('نبّهني على الالتزامات قبل موعدها بـ').selectOption('7')
    await p1.getByText('تم حفظ التفضيلات ✓').waitFor()
  })

  await check('reports page shows saved data', async () => {
    await p1.goto(BASE + 'reports')
    await p1.getByRole('heading', { name: 'التقارير والإحصائيات' }).waitFor()
    await p1.getByTestId('category-report').getByText('الأكل والمقاضي').waitFor()
    await p1.getByText('2,500 ر.س').first().waitFor()
    assert(await overflow(p1) <= 1, 'reports overflow')
    await p1.screenshot({ path: `${shots}/reports.png`, fullPage: true })
  })

  await check('data survives sign out → sign in', async () => {
    await p1.goto(BASE + 'settings')
    await p1.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click()
    await p1.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
    await p1.getByLabel('البريد الإلكتروني').fill(EMAIL_A)
    await p1.getByLabel('كلمة المرور').fill(PASSWORD)
    await p1.getByRole('button', { name: 'دخول' }).click()
    await p1.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    await nav(p1, 'الميزانية').click()
    await p1.getByTestId('expense-list').getByText('غداء عمل').waitFor()
    await p1.getByTestId('fixed-total').getByText('2,500 ر.س').waitFor()
  })

  const ctx2 = await browser.newContext({ ...devices['Pixel 7'], locale: 'ar-SA', timezoneId: 'Asia/Riyadh' })
  const p2 = await ctx2.newPage()
  await check('second device (Android) sees the same data', async () => {
    await p2.goto(BASE + 'login')
    await p2.getByLabel('البريد الإلكتروني').fill(EMAIL_A)
    await p2.getByLabel('كلمة المرور').fill(PASSWORD)
    await p2.getByRole('button', { name: 'دخول' }).click()
    await p2.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    await nav(p2, 'الأهداف').click()
    await p2.getByRole('region', { name: 'هدف صندوق الطوارئ' }).locator('[role=progressbar][aria-valuenow="25"]').waitFor()
    await nav(p2, 'الالتزامات').click()
    await p2.getByTestId('commitment-list').getByText('تجديد استمارة السيارة').waitFor()
  })

  await check('sync: change on device 2 appears on device 1 when it returns to the app (no reload)', async () => {
    await nav(p2, 'الميزانية').click()
    await p2.getByLabel('المبلغ (ر.س)').fill('33')
    await p2.getByLabel('ملاحظة (اختياري)').fill('من الجوال الثاني')
    await p2.getByRole('button', { name: 'إضافة المصروف' }).click()
    await p2.getByTestId('expense-list').getByText('من الجوال الثاني').waitFor()
    const url = p1.url()
    await p1.evaluate(() => window.dispatchEvent(new Event('focus')))
    await p1.getByTestId('expense-list').getByText('من الجوال الثاني').waitFor({ timeout: 10000 })
    assert(p1.url() === url, 'page navigated')
  })

  await check('mobile: every page fits iPhone and Android widths', async () => {
    for (const p of [p1, p2]) {
      for (const path of ['', 'budget', 'commitments', 'goals', 'settings', 'reports']) {
        await p.goto(BASE + path)
        await p.locator('main h1').first().waitFor()
        await p.locator('[role=status]:has-text("جاري التحميل")').waitFor({ state: 'detached' })
        const o = await overflow(p)
        assert(o <= 1, `${path || 'home'} overflow ${o}px on ${p === p1 ? 'iPhone' : 'Pixel'}`)
      }
    }
    await p2.goto(BASE)
    await p2.getByTestId('today-plan').waitFor()
    await p2.waitForTimeout(300)
    await p2.screenshot({ path: `${shots}/android-dashboard.png` })
  })

  await check('sign out on all devices ends device 2 session', async () => {
    await p1.goto(BASE + 'settings')
    p1.once('dialog', (d) => d.accept())
    await p1.getByRole('button', { name: 'تسجيل الخروج من كل الأجهزة' }).click()
    await p1.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
    // جهاز 2: رمز التجديد الخاص به أُبطل. نجربه بالمفتاح الصحيح ونتأكد أن الرفض من خادم المصادقة وليس من البوابة.
    const res = await p2.evaluate(async ({ api, anon }) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      const s = JSON.parse(localStorage.getItem(key))
      const r = await fetch(`${api}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: anon }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      return { status: r.status, body: await r.text() }
    }, { api: API, anon: ANON })
    assert(res.status === 400 && /refresh_token|not_found|revoked/i.test(res.body), `device 2 refresh not revoked: ${res.status} ${res.body.slice(0, 120)}`)
    // ضبط: دخول جديد بعد الخروج الشامل ينجح، ورمز تجديده يعمل ← الاختبار يميّز فعلًا بين الملغى والصالح
    const fresh = await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON }, body: JSON.stringify({ email: EMAIL_A, password: PASSWORD }) })).json()
    const ok = await fetch(`${API}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON }, body: JSON.stringify({ refresh_token: fresh.refresh_token }) })
    assert(ok.status === 200, `control refresh failed ${ok.status}`)
  })

  // جهاز ثالث بجلسة قائمة قبل الاستعادة: يجب أن تنتهي جلسته بعد تغيير كلمة المرور.
  const loginRes = await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON }, body: JSON.stringify({ email: EMAIL_A, password: PASSWORD }) })
  const device3Refresh = (await loginRes.json()).refresh_token

  await check('password recovery from the UI: email link → new password → login with it', async () => {
    assert(loginRes.status === 200 && device3Refresh, 'device 3 login failed')
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const p = await ctx.newPage()
    await p.goto(BASE + 'forgot-password')
    await p.getByLabel('البريد الإلكتروني').fill(EMAIL_A)
    const t = Date.now() - 1000
    await p.getByRole('button', { name: 'إرسال رابط الاستعادة' }).click()
    await p.getByText('إذا كان البريد مسجّلًا عندنا').waitFor()
    await p.goto(await mailLink(EMAIL_A, t))
    await p.getByRole('heading', { name: 'كلمة مرور جديدة' }).waitFor({ timeout: 15000 })
    await p.getByLabel('كلمة المرور الجديدة').fill(NEW_PASSWORD)
    await p.getByLabel('تأكيد كلمة المرور').fill(NEW_PASSWORD)
    await p.getByRole('button', { name: 'حفظ كلمة المرور' }).click()
    await p.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    await ctx.close()
    const q = await (await browser.newContext()).newPage()
    for (const [pw, ok] of [[PASSWORD, false], [NEW_PASSWORD, true]]) {
      await q.goto(BASE + 'login')
      await q.getByLabel('البريد الإلكتروني').fill(EMAIL_A)
      await q.getByLabel('كلمة المرور').fill(pw)
      await q.getByRole('button', { name: 'دخول' }).click()
      if (ok) await q.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
      else await q.getByText('البريد أو كلمة المرور غير صحيحة.').waitFor()
    }
    await q.context().close()
  })

  await check('changing the password ends sessions on other devices', async () => {
    const r = await fetch(`${API}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON }, body: JSON.stringify({ refresh_token: device3Refresh }) })
    assert(r.status === 400, `device 3 session still valid after password change (${r.status})`)
  })

  await check('second user (B) sees none of user A data', async () => {
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    await p.goto(BASE + 'register')
    await p.getByLabel('البريد الإلكتروني').fill(EMAIL_B)
    await p.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD)
    await p.getByLabel('تأكيد كلمة المرور').fill(PASSWORD)
    const t = Date.now() - 1000
    await p.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await p.getByRole('heading', { name: 'تحقق من بريدك' }).waitFor()
    await p.goto(await mailLink(EMAIL_B, t))
    await p.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor({ timeout: 15000 })
    await p.getByText('أدخل دخلك الشهري').waitFor()
    for (const [path, text] of [['budget', 'ما سجّلت مصاريف هذا الشهر'], ['commitments', 'ما عندك التزامات قادمة'], ['goals', 'ما عندك أهداف بعد']]) {
      await p.goto(BASE + path)
      await p.getByText(text).waitFor()
    }
    assert(await p.getByText('غداء عمل').count() === 0, 'A data visible to B')
    await ctx.close()
  })

  await check('no uncaught errors in the main session', async () => {
    assert(errors.length === 0, errors.join(' | ') + ' || API responses ≥400: ' + failed.join(', '))
  })
} finally {
  await browser.close()
  server.close()
}

for (const r of results) console.log(r.join('  '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
