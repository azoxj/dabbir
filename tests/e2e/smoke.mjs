// اختبار دخان على نسخة البناء بمتصفح Chromium حقيقي، عبر خادم يحاكي GitHub Pages تحت /dabbir/.
// التشغيل: npm run build && npm run test:e2e   (لقطات الشاشة في tests/e2e/screenshots)
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { startPagesServer } from './pages-server.mjs'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const shots = `${root}tests/e2e/screenshots`
await mkdir(shots, { recursive: true })
const PORT = 4180
const BASE_PATH = process.env.E2E_BASE ?? '/dabbir/'
const ORIGIN = `http://localhost:${PORT}`
const BASE = ORIGIN + BASE_PATH

const server = await startPagesServer({ root: `${root}dist`, base: BASE_PATH, port: PORT })
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

try {
  const browser = await chromium.launch()

  /* ================= iPhone: التدفق الكامل ================= */
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-SA', timezoneId: 'Asia/Riyadh' })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404 (Not Found)') && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  const failedAssets = []
  page.on('response', (r) => { if (r.status() >= 400 && !r.request().isNavigationRequest()) failedAssets.push(`${r.status()} ${r.url()}`) })

  const nav = (name) => page.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name, exact: true })
  const noHorizontalOverflow = async (label) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert(o <= 1, `${label}: horizontal overflow ${o}px`)
  }

  await check('root /dabbir/ redirects to login, RTL Arabic', async () => {
    await page.goto(BASE)
    await page.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
    assert(new URL(page.url()).pathname === `${BASE_PATH}login`, `url=${page.url()}`)
    const { dir, lang } = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }))
    assert(dir === 'rtl' && lang === 'ar', `dir=${dir} lang=${lang}`)
    const logo = await page.locator('img').first().evaluate((i) => i.naturalWidth)
    assert(logo > 0, 'logo image failed to load')
    await noHorizontalOverflow('login')
    await page.screenshot({ path: `${shots}/01-login.png` })
  })

  await check('/dabbir (no trailing slash) works', async () => {
    const r = await page.goto(ORIGIN + BASE_PATH.slice(0, -1))
    assert(r.ok(), `status ${r.status()}`)
    await page.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
  })

  await check('register → dashboard «وش أسوي اليوم؟»', async () => {
    await page.getByRole('link', { name: 'أنشئ حساب' }).click()
    assert(new URL(page.url()).pathname === `${BASE_PATH}register`, `url=${page.url()}`)
    await page.getByLabel('الاسم (اختياري)').fill('نورة')
    await page.getByLabel('البريد الإلكتروني').fill('noura@example.sa')
    await page.getByLabel('كلمة المرور', { exact: true }).fill('secret123')
    await page.getByLabel('تأكيد كلمة المرور').fill('secret123')
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await page.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    await page.getByText('أدخل دخلك الشهري').waitFor()
  })

  await check('budget: income, savings, expense (Arabic digits)', async () => {
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

  await check('commitments: add and complete', async () => {
    await nav('الالتزامات').click()
    await page.getByRole('button', { name: '+ إضافة التزام أو موعد' }).click()
    await page.getByLabel('الاسم').fill('سداد فاتورة الكهرباء')
    await page.getByLabel('المبلغ (اختياري)').fill('280')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    const list = page.getByTestId('commitment-list')
    await list.getByText('سداد فاتورة الكهرباء').waitFor()
    await page.getByRole('button', { name: '+ إضافة التزام أو موعد' }).click()
    await page.getByLabel('الاسم').fill('موعد المستشفى')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await list.getByText('موعد المستشفى').waitFor()
    page.once('dialog', (d) => d.accept())
    await list.getByRole('button', { name: 'تم موعد المستشفى' }).click() // بدون مبلغ ← لا سؤال
    await page.getByText('أحسنت! تم ✓').waitFor()
    await noHorizontalOverflow('commitments')
  })

  await check('goals: add, deposit, withdraw', async () => {
    await nav('الأهداف').click()
    await page.getByRole('button', { name: '+ هدف ادخار جديد' }).click()
    await page.getByLabel('اسم الهدف').fill('صندوق الطوارئ')
    await page.getByLabel('المبلغ المستهدف').fill('24000')
    await page.getByRole('button', { name: 'حفظ الهدف' }).click()
    const card = page.getByRole('region', { name: 'هدف صندوق الطوارئ' })
    await card.getByLabel('المبلغ').fill('6000')
    await card.getByRole('button', { name: 'إيداع' }).click()
    await card.locator('[role=progressbar][aria-valuenow="25"]').waitFor()
    await card.getByLabel('المبلغ').fill('1200')
    await card.getByRole('button', { name: 'سحب' }).click()
    await card.locator('[role=progressbar][aria-valuenow="20"]').waitFor()
    await noHorizontalOverflow('goals')
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

  await check('direct refresh on every deep link (GitHub Pages 404.html fallback)', async () => {
    const pages = { budget: 'الميزانية والمصاريف', commitments: 'الالتزامات والمواعيد', goals: 'أهداف الادخار', settings: 'الملف الشخصي والإعدادات', '': 'وش أسوي اليوم؟' }
    for (const [path, heading] of Object.entries(pages)) {
      await page.goto(BASE + path)
      await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 10000 })
      assert(new URL(page.url()).pathname === BASE_PATH + path, `stayed on ${path}: ${page.url()}`)
    }
    await page.goto(BASE + 'budget#add')
    await page.waitForFunction(() => document.activeElement?.getAttribute('inputmode') === 'decimal')
    await page.goto(BASE + 'no-such-page')
    await page.getByRole('heading', { name: 'الصفحة غير موجودة' }).waitFor()
    await page.getByRole('link', { name: 'الرجوع للرئيسية' }).click()
    await page.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
  })

  await check('browser back/forward navigation', async () => {
    await nav('الأهداف').click()
    await nav('الميزانية').click()
    await page.goBack()
    await page.getByRole('heading', { name: 'أهداف الادخار' }).waitFor()
    await page.goForward()
    await page.getByRole('heading', { name: 'الميزانية والمصاريف' }).waitFor()
  })

  await check('profile: edit name', async () => {
    await nav('حسابي').click()
    await page.getByLabel('الاسم', { exact: true }).fill('نورة العتيبي')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await page.getByText('تم حفظ الاسم ✓').waitFor()
    await noHorizontalOverflow('settings')
  })

  await check('manifest: valid, icons resolve relative to manifest URL', async () => {
    const href = await page.locator('link[rel=manifest]').getAttribute('href')
    assert(href === `${BASE_PATH}manifest.webmanifest`, `manifest href ${href}`)
    const murl = new URL(href, ORIGIN)
    const m = await (await fetch(murl)).json()
    assert(m.dir === 'rtl' && m.lang === 'ar' && m.display === 'standalone', 'manifest dir/lang/display')
    assert(new URL(m.start_url, murl).pathname === BASE_PATH && new URL(m.scope, murl).pathname === BASE_PATH, 'start_url/scope')
    for (const icon of m.icons) {
      const r = await fetch(new URL(icon.src, murl))
      assert(r.ok && r.headers.get('content-type')?.includes('png'), `icon ${icon.src} → ${r.status}`)
    }
    assert(m.icons.some((i) => i.purpose === 'maskable'), 'maskable icon')
    const apple = await page.locator('link[rel=apple-touch-icon]').getAttribute('href')
    assert((await fetch(new URL(apple, ORIGIN))).ok, 'apple-touch-icon')
  })

  await check('service worker: scope /dabbir/, offline reload of deep link', async () => {
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
    assert(new URL(scope).pathname === BASE_PATH, `scope=${scope}`)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await ctx.setOffline(true)
    await page.goto(BASE + 'goals')
    await page.getByRole('heading', { name: 'أهداف الادخار' }).waitFor()
    await page.getByText('أنت غير متصل بالإنترنت.').waitFor()
    await page.getByRole('region', { name: 'هدف صندوق الطوارئ' }).waitFor()
    await ctx.setOffline(false)
  })

  await check('sign out', async () => {
    await page.goto(BASE + 'settings')
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
    await page.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
  })

  await check('guest demo data + screenshots', async () => {
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

  await check('no failed asset requests / console errors / CSP violations', async () => {
    assert(failedAssets.length === 0, failedAssets.join(' | '))
    assert(consoleErrors.length === 0, consoleErrors.join(' | '))
  })
  await ctx.close()

  /* ================= Android (Pixel 7): كل الصفحات بدون تمرير أفقي ================= */
  await check('Android Pixel 7: all pages render without horizontal overflow', async () => {
    const actx = await browser.newContext({ ...devices['Pixel 7'], locale: 'ar-SA' })
    const ap = await actx.newPage()
    await ap.goto(BASE + 'login')
    await ap.getByRole('button', { name: 'جرّب التطبيق ببيانات تجريبية' }).click()
    await ap.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    const headings = { الميزانية: 'الميزانية والمصاريف', الالتزامات: 'الالتزامات والمواعيد', الأهداف: 'أهداف الادخار', حسابي: 'الملف الشخصي والإعدادات', اليوم: 'وش أسوي اليوم؟' }
    for (const [name, heading] of Object.entries(headings)) {
      const link = ap.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name, exact: true })
      await link.click()
      await ap.getByRole('heading', { name: heading, exact: true }).waitFor()
      await ap.locator('[role=status]:has-text("جاري التحميل")').waitFor({ state: 'detached' })
      assert((await link.getAttribute('aria-current')) === 'page', `${name}: nav item not marked active`)
      const o = await ap.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert(o <= 1, `${name}: overflow ${o}px`)
      // أهداف اللمس في شريط التنقل ≥ 44px
      const h = await ap.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name, exact: true }).evaluate((e) => e.getBoundingClientRect().height)
      assert(h >= 44, `${name}: tap target ${h}px`)
    }
    await ap.getByTestId('today-plan').waitFor()
    await ap.waitForTimeout(300) // انتهاء انتقال ألوان شريط التنقل
    await ap.screenshot({ path: `${shots}/07-android-dashboard.png` })
    await actx.close()
  })

  await browser.close()
} finally {
  server.close()
}

for (const r of results) console.log(r.join('  '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
