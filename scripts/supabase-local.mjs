// إدارة Supabase المحلي (Docker): start | stop | reset | status
// - يولّد أسرارًا عشوائية محلية في supabase/local/.env (مُستثنى من git).
// - يطبّق ملفات supabase/migrations بالترتيب (نفس الملفات التي تُطبَّق على مشروع Supabase الحقيقي).
// - يشغّل بوابة على http://localhost:54321 بنفس مسارات Supabase.
// - لا يولّد ولا يستخدم مفتاح service_role.
import { execFileSync, spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = `${root}supabase/local`
const envFile = `${dir}/.env`
const pidFile = `${dir}/.gateway.pid`
const compose = (...args) => execFileSync('docker', ['compose', '-f', `${dir}/docker-compose.yml`, '--env-file', envFile, ...args], { stdio: 'pipe' }).toString()

const b64url = (s) => Buffer.from(s).toString('base64url')
export function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`
}

export function loadEnv() {
  if (!existsSync(envFile)) {
    const secret = randomBytes(32).toString('hex')
    const anon = signJwt({ role: 'anon', iss: 'supabase-local', iat: 1700000000, exp: 4900000000 }, secret)
    writeFileSync(envFile, [
      `LOCAL_DB_PASSWORD=${randomBytes(18).toString('hex')}`,
      `LOCAL_JWT_SECRET=${secret}`,
      `LOCAL_JWT_EXP=${process.env.LOCAL_JWT_EXP ?? 3600}`,
      'VITE_SUPABASE_URL=http://localhost:54321',
      `VITE_SUPABASE_ANON_KEY=${anon}`,
      '',
    ].join('\n'), { mode: 0o600 })
  }
  return Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(name, fn, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try { if (await fn()) return } catch { /* retry */ }
    await sleep(1000)
  }
  throw new Error(`${name} did not become ready`)
}

function psql(sql, user = 'supabase_admin') {
  return compose('exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', 'postgres', '-c', sql)
}
function psqlFile(path, user = 'postgres') {
  return execFileSync('docker', ['compose', '-f', `${dir}/docker-compose.yml`, '--env-file', envFile, 'exec', '-T', 'db',
    'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', user, '-d', 'postgres'], { input: readFileSync(path), stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } }).toString()
}

async function start() {
  const env = loadEnv()
  console.log('▶ db + mail')
  compose('up', '-d', '--wait', 'db', 'mail')
  // مثل roles.sql في Supabase المستضاف ذاتيًا: كلمات مرور أدوار الخدمات.
  const pw = env.LOCAL_DB_PASSWORD
  psql(`ALTER USER authenticator WITH PASSWORD '${pw}'; ALTER USER supabase_auth_admin WITH PASSWORD '${pw}'; ALTER USER postgres WITH PASSWORD '${pw}';`)
  console.log('▶ auth + rest')
  compose('up', '-d', 'auth', 'rest')
  await waitFor('auth', async () => (await fetch('http://127.0.0.1:54329/health')).ok)
  console.log('▶ migrations')
  for (const f of readdirSync(`${root}supabase/migrations`).filter((f) => f.endsWith('.sql')).sort()) {
    psqlFile(`${root}supabase/migrations/${f}`)
    console.log('  ✓', f)
  }
  psql(`NOTIFY pgrst, 'reload schema';`)
  await waitFor('rest', async () => (await fetch('http://127.0.0.1:54323/')).status < 500)
  if (!existsSync(pidFile)) {
    const gw = spawn(process.execPath, [`${root}scripts/supabase-gateway.mjs`], {
      detached: true, stdio: 'ignore', env: { ...process.env, GATEWAY_API_KEYS: env.VITE_SUPABASE_ANON_KEY },
    })
    gw.unref()
    writeFileSync(pidFile, String(gw.pid))
  }
  await waitFor('gateway', async () => (await fetch('http://127.0.0.1:54321/auth/v1/health')).ok)
  console.log('\n✅ Supabase محلي جاهز')
  console.log('   API:     http://localhost:54321')
  console.log('   البريد:  http://localhost:54324 (Mailpit)')
  console.log('   تشغيل التطبيق عليه:  npm run dev:local')
}

function stopGateway() {
  if (existsSync(pidFile)) {
    try { process.kill(Number(readFileSync(pidFile, 'utf8'))) } catch { /* already stopped */ }
    unlinkSync(pidFile)
  }
}

const cmd = process.argv[2]
if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === 'start') await start()
  else if (cmd === 'stop') { stopGateway(); loadEnv(); compose('down'); console.log('stopped') }
  else if (cmd === 'reset') { stopGateway(); loadEnv(); compose('down', '-v'); await start() }
  else if (cmd === 'status') { loadEnv(); console.log(compose('ps')) }
  else { console.log('usage: node scripts/supabase-local.mjs start|stop|reset|status'); process.exit(2) }
}
