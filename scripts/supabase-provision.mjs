// تجهيز مشروع Supabase الحقيقي عبر Management API الرسمية (https://api.supabase.com).
//
//   node scripts/supabase-provision.mjs plan                 ← يعرض ما سيُنفَّذ فقط (بدون تغييرات)
//   node scripts/supabase-provision.mjs apply [--i-have-a-backup]
//
// المصادقة: Personal Access Token من Supabase في SUPABASE_ACCESS_TOKEN (لا يُطبع أبدًا، ولا يُحفظ في المستودع).
// ما يفعله (آمن لإعادة التشغيل):
//   1) يجد مشروعًا باسم SUPABASE_PROJECT_NAME (افتراضي: dabbir) أو ينشئه على الخطة المجانية.
//   2) يرفض تطبيق migrations إذا وُجدت بيانات في جداول دبّر، إلا مع --i-have-a-backup.
//   3) يطبّق ملفات supabase/migrations بالترتيب.
//   4) يضبط المصادقة: تأكيد البريد إلزامي، 8 أحرف، روابط العودة لـ GitHub Pages، قوالب بريد عربية.
//   5) يكتب .env.production بالقيم العامة فقط (URL + publishable/anon key) — لا service_role إطلاقًا.
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const API = 'https://api.supabase.com/v1'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'injected-by-proxy'
const NAME = process.env.SUPABASE_PROJECT_NAME || 'dabbir'
const REGION = process.env.SUPABASE_REGION || 'eu-central-1'
const SITE = process.env.DABBIR_SITE_URL || 'https://azoxj.github.io/dabbir/'
const DEV_URLS = ['http://localhost:5173/dabbir/**', 'http://localhost:4180/dabbir/**']
const TABLES = ['expenses', 'budget_limits', 'commitments', 'savings_goals']

const mode = process.argv[2]
const backupConfirmed = process.argv.includes('--i-have-a-backup')
if (!['plan', 'apply'].includes(mode)) { console.log('usage: plan | apply [--i-have-a-backup]'); process.exit(2) }

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}
const sql = (ref, query) => api('POST', `/projects/${ref}/database/query`, { query })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const authConfig = {
  site_url: SITE,
  uri_allow_list: [SITE + '**', ...DEV_URLS].join(','),
  disable_signup: false,
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: true,
  password_min_length: 8,
  refresh_token_rotation_enabled: true,
  security_refresh_token_reuse_interval: 10,
  jwt_exp: 3600,
  mailer_subjects_confirmation: 'دبّر — أكّد بريدك الإلكتروني',
  mailer_subjects_recovery: 'دبّر — استعادة كلمة المرور',
  mailer_templates_confirmation_content: readFileSync(`${root}supabase/templates/confirmation.html`, 'utf8'),
  mailer_templates_recovery_content: readFileSync(`${root}supabase/templates/recovery.html`, 'utf8'),
}

const projects = await api('GET', '/projects')
let project = projects.find((p) => p.name === NAME)
console.log(project ? `• مشروع موجود: ${NAME} (${project.id}, ${project.region}, ${project.status})` : `• لا يوجد مشروع باسم ${NAME} — سيُنشأ (خطة مجانية، ${REGION})`)

if (mode === 'plan') {
  const migrations = readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith('.sql')).sort()
  console.log('• migrations:', migrations.join(', '))
  console.log('• إعدادات المصادقة:', Object.keys(authConfig).join(', '))
  console.log('• سيكتب .env.production بالقيم العامة فقط')
  process.exit(0)
}

if (!project) {
  const orgs = await api('GET', '/organizations')
  if (!orgs.length) throw new Error('لا توجد منظمة في حساب Supabase')
  project = await api('POST', '/projects', {
    name: NAME, organization_id: orgs[0].id, region: REGION, plan: 'free',
    // كلمة مرور قاعدة البيانات: عشوائية ولا تُحفظ. يمكن إعادة تعيينها من لوحة Supabase عند الحاجة.
    db_pass: randomBytes(24).toString('base64url'),
  })
  console.log('• أُنشئ المشروع', project.id)
}
const ref = project.id
for (let i = 0; i < 90; i++) {
  const p = await api('GET', `/projects/${ref}`)
  if (p.status === 'ACTIVE_HEALTHY') break
  if (i === 89) throw new Error(`المشروع لم يصبح جاهزًا (${p.status})`)
  await sleep(10_000)
}
console.log('• المشروع جاهز')

// حماية البيانات: لا migrations على قاعدة فيها بيانات بدون نسخة احتياطية مؤكدة.
const existing = await sql(ref, `select ${TABLES.map((t) => `(select count(*) from information_schema.tables where table_schema='public' and table_name='${t}') as has_${t}`).join(', ')}`)
const hasAny = TABLES.some((t) => existing[0][`has_${t}`] > 0)
if (hasAny) {
  const counts = await sql(ref, TABLES.map((t) => `select '${t}' as t, count(*)::int as n from public.${t}`).join(' union all '))
  const rows = counts.reduce((s, r) => s + r.n, 0)
  console.log('• بيانات موجودة:', counts.map((r) => `${r.t}=${r.n}`).join(', '))
  if (rows > 0 && !backupConfirmed) {
    console.error('✋ توقف: القاعدة فيها بيانات. خذ نسخة احتياطية (Database → Backups) ثم أعد التشغيل مع --i-have-a-backup')
    process.exit(3)
  }
}
for (const f of readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith('.sql')).sort()) {
  await sql(ref, readFileSync(`${root}supabase/migrations/${f}`, 'utf8'))
  console.log('  ✓', f)
}
const rls = await sql(ref, `select count(*)::int as n from pg_tables where schemaname='public' and not rowsecurity`)
if (rls[0].n !== 0) throw new Error('يوجد جدول بدون RLS!')
console.log('• RLS مفعّل على كل جداول public')

await api('PATCH', `/projects/${ref}/config/auth`, authConfig)
console.log('• ضُبطت إعدادات المصادقة')

const keys = await api('GET', `/projects/${ref}/api-keys?reveal=false`)
const pub = keys.find((k) => k.type === 'publishable') ?? keys.find((k) => k.name === 'anon')
if (!pub?.api_key) throw new Error('لم يُعثر على المفتاح العام')
writeFileSync(`${root}.env.production`, [
  '# قيم عامة بطبيعتها (تظهر في ملفات الواجهة لأي زائر). الحماية الحقيقية عبر RLS.',
  '# لا تضع هنا service_role أو أي مفتاح سري — CI والتطبيق يرفضانه.',
  `VITE_SUPABASE_URL=https://${ref}.supabase.co`,
  `VITE_SUPABASE_ANON_KEY=${pub.api_key}`,
  '',
].join('\n'))
console.log(`\n✅ تم. الرابط: https://${ref}.supabase.co — كُتب .env.production (قيم عامة فقط)`)
