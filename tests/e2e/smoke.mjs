// اختبار دخان على نسخة البناء (vite preview) بمتصفح Chromium حقيقي وبحجم جوال.
// التشغيل: npm run build && npm run test:e2e   (لقطات الشاشة في tests/e2e/screenshots)
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const shots = `${root}tests/e2e/screenshots`
await mkdir(shots, { recursive: true })
const PORT = 4179
const BASE = `http://localhost:${PORT}`

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' })
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

try {
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); break } catch { await new Promise((r) => setTimeout(r, 200)) } }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-SA', timezoneId: 'Asia/Riyadh' })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push(e.message))

  const nav = (name) => page.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name, exact: true })
  const noHorizontalOverflow = async (label) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert(o <= 1, `${label}: horizontal overflow ${o}px`)
  }

  await check('login page renders RTL Arabic', async () => {
    await page.goto(BASE + '/')
    await page.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
    const { dir, lang } = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }))
    assert(dir === 'rtl' && lang === 'ar', `dir=${dir} lang=${lang}`)
    await noHorizontalOverflow('login')
    await page.screenshot({ path: `${shots}/01-login.png` })
  })

  await check('register → dashboard «وش أسوي اليوم؟»', async () => {
    await page.getByRole('link', { name: 'أنشئ حساب' }).click()
    await page.getByLabel('الاسم (اختياري)').fill('نورة')
    await page.getByLabel('البريد الإلكتروني').fill('noura@example.sa')
    await page.getByLabel('كلمة المرور', { exact: true }).fill('secret123')
    await page.getByLabel('تأكيد كلمة المرور').fill('secret123')
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await page.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    await page.getByText('أدخل دخلك الشهري').waitFor()
  })

  await check('budget: set income and add expense', async () => {
    await nav('الميزانية').click()
    await page.getByLabel('الدخل الشهري (ر.س)').fill('8000')
    await page.getByLabel('هدف الادخار الشهري').fill('800')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await page.getByText('تم حفظ إعدادات الدخل ✓').waitFor()
    await page.getByLabel('المبلغ (ر.س)').fill('٣٥')
    await page.getByLabel('ملاحظة (اختياري)').fill('غداء')
    await page.getByRole('button', { name: 'إضافة المصروف' }).click()
    await page.getByTestId('expense-list').getByText('غداء').waitFor()
    await noHorizontalOverflow('budget')
  })

  await check('commitments: add one due today', async () => {
    await nav('الالتزامات').click()
    await page.getByRole('button', { name: '+ إضافة التزام أو موعد' }).click()
    await page.getByLabel('الاسم').fill('سداد فاتورة الكهرباء')
    await page.getByLabel('المبلغ (اختياري)').fill('280')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await page.getByTestId('commitment-list').getByText('سداد فاتورة الكهرباء').waitFor()
  })

  await check('goals: add and deposit', async () => {
    await nav('الأهداف').click()
    await page.getByRole('button', { name: '+ هدف ادخار جديد' }).click()
    await page.getByLabel('اسم الهدف').fill('صندوق الطوارئ')
    await page.getByLabel('المبلغ المستهدف').fill('24000')
    await page.getByRole('button', { name: 'حفظ الهدف' }).click()
    const card = page.getByRole('region', { name: 'هدف صندوق الطوارئ' })
    await card.getByLabel('المبلغ').fill('6000')
    await card.getByRole('button', { name: 'إيداع' }).click()
    await card.locator('[role=progressbar][aria-valuenow="25"]').waitFor()
    await page.screenshot({ path: `${shots}/04-goals.png` })
  })

  await check('dashboard reflects entered data', async () => {
    await nav('اليوم').click()
    const plan = page.getByTestId('today-plan')
    await plan.getByText('اليوم: سداد فاتورة الكهرباء').waitFor()
    assert(!(await plan.getByText('سجّل مصاريف اليوم').count()), 'should not ask to log expenses after logging one')
    await noHorizontalOverflow('dashboard')
    await page.screenshot({ path: `${shots}/02-dashboard.png`, fullPage: true })
  })

  await check('manifest is valid and installable-shaped', async () => {
    const m = await (await fetch(BASE + '/manifest.webmanifest')).json()
    assert(m.dir === 'rtl' && m.lang === 'ar' && m.display === 'standalone', 'manifest dir/lang/display')
    for (const icon of m.icons) {
      const r = await fetch(BASE + icon.src)
      assert(r.ok && r.headers.get('content-type')?.includes('png'), `icon ${icon.src}`)
    }
    assert(m.icons.some((i) => i.purpose === 'maskable'), 'maskable icon')
    assert((await fetch(BASE + '/icons/apple-touch-icon.png')).ok, 'apple-touch-icon')
  })

  await check('service worker activates and app works offline', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // تأكد أن الصفحة صارت تحت تحكم SW
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await ctx.setOffline(true)
    await page.goto(BASE + '/goals')
    await page.getByRole('heading', { name: 'أهداف الادخار' }).waitFor()
    await page.getByText('أنت غير متصل بالإنترنت.').waitFor()
    await ctx.setOffline(false)
  })

  await check('sign out', async () => {
    await nav('حسابي').click()
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
    await page.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
  })

  await check('no console errors / CSP violations', async () => {
    assert(consoleErrors.length === 0, consoleErrors.join(' | '))
  })

  // لقطات إضافية للبطاقات (بيانات الضيف)
  await check('guest demo screenshots', async () => {
    await page.getByRole('button', { name: 'جرّب التطبيق ببيانات تجريبية' }).click()
    await page.getByTestId('today-plan').getByText('متأخر: فاتورة الجوال').waitFor()
    await page.screenshot({ path: `${shots}/03-dashboard-guest.png`, fullPage: true })
    await nav('الميزانية').click()
    await page.getByText('حسب الفئة').waitFor()
    await page.screenshot({ path: `${shots}/05-budget-guest.png`, fullPage: true })
    await nav('الالتزامات').click()
    await page.getByTestId('commitment-list').waitFor()
    await page.screenshot({ path: `${shots}/06-commitments-guest.png`, fullPage: true })
  })

  await browser.close()
} finally {
  server.kill()
}

for (const r of results) console.log(r.join('  '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
