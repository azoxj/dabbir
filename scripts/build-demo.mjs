// بناء بالوضع التجريبي فقط (يتجاهل .env.production) — لاختبارات الوضع التجريبي.
import { spawnSync } from 'node:child_process'
const r = spawnSync('npx', ['vite', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
})
process.exit(r.status ?? 1)
