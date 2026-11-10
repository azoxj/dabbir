// يتحقق أن ملفات .env المُلتزمة في المستودع لا تحتوي إلا قيمًا عامة مسموحة، ولا مفاتيح سرية.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ALLOWED = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_BASE'])
let failed = false
const fail = (m) => { console.error('✗', m); failed = true }

function role(jwt) {
  try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role ?? null } catch { return null }
}

for (const name of ['.env.production', '.env.example']) {
  const path = root + name
  if (!existsSync(path)) continue
  for (const [i, raw] of readFileSync(path, 'utf8').split('\n').entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const key = line.slice(0, line.indexOf('='))
    const value = line.slice(line.indexOf('=') + 1).trim()
    if (!ALLOWED.has(key)) fail(`${name}:${i + 1} متغير غير مسموح: ${key}`)
    if (/sb_secret_/.test(value)) fail(`${name}:${i + 1} مفتاح سري (sb_secret_)`)
    if (value.split('.').length === 3 && role(value) && role(value) !== 'anon') fail(`${name}:${i + 1} JWT بدور ${role(value)}`)
    if (key === 'VITE_SUPABASE_URL' && value && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value)) fail(`${name}:${i + 1} رابط Supabase غير متوقع`)
  }
}
if (failed) process.exit(1)
console.log('✓ ملفات env العامة سليمة')
