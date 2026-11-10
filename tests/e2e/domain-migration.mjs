// اختبار الانتقال من الرابط القديم إلى الدومين الجديد في متصفح حقيقي:
//   azoxj.github.io.localhost/dabbir/  ←301→  dabbir.online.localhost/  (محليًا، بنفس سلوك GitHub Pages)
// نفس ملفات البناء تُخدم من العنوانين، كما سيحدث فعليًا. يتحقق من:
//   - عمل التطبيق على العنوانين قبل الانتقال (بدون توقف).
//   - إعادة التوجيه بعد الانتقال حتى مع Service Worker قديم مثبّت.
//   - أن بيانات الوضع التجريبي لا تنتقل تلقائيًا (عنوانان مختلفان)، وأن النسخة الاحتياطية تنقلها كاملة.
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { startPagesServer } from './pages-server.mjs'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const root = fileURLToPath(new URL('../..', import.meta.url))
const shots = `${root}tests/e2e/screenshots/migration`
await mkdir(shots, { recursive: true })
// *.localhost سياق آمن في المتصفح (مثل HTTPS في الموقع الحقيقي) ويُحل تلقائيًا إلى 127.0.0.1.
const OLD = 'http://azoxj.github.io.localhost:4191/dabbir/'
const NEW = 'http://dabbir.online.localhost:4192/'

const results = []
let step = ''
const mark = (s) => { step = s }
const check = async (name, fn) => {
  step = ''
  try { await fn(); results.push(['PASS', name]) } catch (e) {
    results.push(['FAIL', name, `[${step}] ` + e.message.split('\n')[0]])
    await globalThis.__page?.screenshot({ path: `${shots}/fail-${results.length}.png` }).catch(() => {})
  }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

const oldServer = await startPagesServer({ root: `${root}dist`, base: '/dabbir/', port: 4191 })
const newServer = await startPagesServer({ root: `${root}dist`, base: '/', port: 4192 })
const browser = await chromium.launch({
  args: ['--host-resolver-rules=MAP azoxj.github.io.localhost 127.0.0.1, MAP dabbir.online.localhost 127.0.0.1'],
})
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-SA', acceptDownloads: true })
  const page = await ctx.newPage()
  globalThis.__page = page
  const nav = (name) => page.getByRole('navigation', { name: 'القائمة الرئيسية' }).getByRole('link', { name, exact: true })
  let backupPath

  await check('before the move: old address works, shows the moving notice, demo data saved', async () => {
    await page.goto(OLD + 'login')
    await page.getByRole('button', { name: 'جرّب التطبيق ببيانات تجريبية' }).click()
    await page.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    await page.getByTestId('moving-banner').waitFor()
    await nav('الميزانية').click()
    await page.getByLabel('المبلغ (ر.س)').fill('77')
    await page.getByLabel('ملاحظة (اختياري)').fill('قبل الانتقال')
    await page.getByRole('button', { name: 'إضافة المصروف' }).click()
    await page.getByTestId('expense-list').getByText('قبل الانتقال').waitFor()
    await page.evaluate(() => navigator.serviceWorker.ready)
    assert(new URL(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).pathname === '/dabbir/', 'old SW scope')
  })

  await check('before the move: the new domain already serves the same build at the root', async () => {
    const p = await (await browser.newContext()).newPage()
    await p.goto(NEW + 'budget')
    await p.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
    assert(new URL(p.url()).pathname === '/login', `redirected to ${p.url()}`)
    assert(await p.getByTestId('moving-banner').count() === 0, 'moving banner on new domain')
    await p.context().close()
  })

  await check('backup download on the old address', async () => {
    await nav('حسابي').click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تنزيل نسخة احتياطية' }).click()])
    backupPath = `${shots}/backup.json`
    await download.saveAs(backupPath)
    const data = JSON.parse(await readFile(backupPath, 'utf8'))
    assert(data.format === 'dabbir-backup' && data.expenses.some((e) => e.note === 'قبل الانتقال'), 'backup content')
    assert(!JSON.stringify(data).includes('passwordHash') && !JSON.stringify(data).includes('"hash"'), 'backup must not contain credentials')
  })

  // ===== الانتقال: GitHub يحوّل الرابط القديم إلى الدومين =====
  oldServer.setRedirect('http://dabbir.online.localhost:4192')

  await check('after the move: old deep link redirects to the same page on the new domain (old Service Worker installed)', async () => {
    await page.goto(OLD + 'budget')
    await page.waitForURL((u) => u.hostname === 'dabbir.online.localhost', { timeout: 15000 })
    assert(new URL(page.url()).pathname === '/login' || new URL(page.url()).pathname === '/budget', `landed on ${page.url()}`)
    await page.getByRole('heading', { name: 'تسجيل الدخول' }).waitFor()
  })

  await check('as expected: demo data does NOT move automatically (different origin)', async () => {
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dabbir.')))
    assert(keys.length === 0, `unexpected data on new origin: ${keys.join(',')}`)
  })

  await check('restore the backup on the new domain → data is back', async () => {
    mark('register link'); await page.getByRole('link', { name: 'أنشئ حساب' }).click()
    mark('register form'); await page.getByRole('heading', { name: 'إنشاء حساب' }).waitFor()
    await page.getByLabel('البريد الإلكتروني').fill('me@example.test')
    await page.getByLabel('كلمة المرور', { exact: true }).fill('pass1234x')
    await page.getByLabel('تأكيد كلمة المرور').fill('pass1234x')
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
    mark('dashboard after register'); await page.getByRole('heading', { name: 'وش أسوي اليوم؟' }).waitFor()
    mark('settings'); await page.goto(NEW + 'settings')
    mark('file input'); page.once('dialog', (d) => d.accept())
    await page.getByLabel('ملف النسخة الاحتياطية').setInputFiles(backupPath)
    await page.getByText(/تمت الاستعادة ✓/).waitFor().catch(async (e) => {
      await page.screenshot({ path: `${shots}/restore-fail.png`, fullPage: true })
      const alert = await page.getByRole('alert').allTextContents()
      throw new Error(`restore: ${alert.join(' | ') || e.message}`)
    })
    mark('budget list'); await page.goto(NEW + 'budget')
    await page.getByTestId('expense-list').getByText('قبل الانتقال').waitFor()
    await page.goto(NEW + 'goals')
    await page.getByRole('region', { name: 'هدف صندوق الطوارئ' }).waitFor()
  })

  await check('new domain: Service Worker at the root, manifest start_url = /, deep link refresh works', async () => {
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
    assert(new URL(scope).pathname === '/', `scope ${scope}`)
    const m = await page.evaluate(async (u) => (await fetch(u)).json(), NEW + 'manifest.webmanifest')
    assert(new URL(m.start_url, NEW + 'manifest.webmanifest').pathname === '/', 'start_url')
    await page.goto(NEW + 'commitments')
    await page.getByRole('heading', { name: 'الالتزامات والمواعيد' }).waitFor()
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert(o <= 1, `overflow ${o}`)
    await page.screenshot({ path: `${shots}/new-domain.png` })
  })
  await ctx.close()
} finally {
  await browser.close()
  oldServer.close()
  newServer.close()
}
for (const r of results) console.log(r.join('  '))
const failed = results.filter((r) => r[0] === 'FAIL').length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
