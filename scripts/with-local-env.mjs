// يشغّل أمرًا مع إعدادات Supabase المحلي (URL + anon key فقط) من supabase/local/.env
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const envFile = fileURLToPath(new URL('../supabase/local/.env', import.meta.url))
const vars = Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => l.startsWith('VITE_SUPABASE_'))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const [cmd, ...args] = process.argv.slice(2)
const r = spawnSync('npx', [cmd, ...args], { stdio: 'inherit', env: { ...process.env, ...vars } })
process.exit(r.status ?? 1)
