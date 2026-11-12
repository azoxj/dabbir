// يشغّل supabase/tests/remote-rls.sql على المشروع الحقيقي (SUPABASE_PROJECT_REF) عبر Management API.
// التوكن: SUPABASE_ACCESS_TOKEN (أو يحقنه الـ proxy). لا يترك أي بيانات: الاختبار يُلغى بالكامل في نهايته.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ref = process.env.SUPABASE_PROJECT_REF
if (!ref) { console.error('SUPABASE_PROJECT_REF required'); process.exit(2) }
const sql = readFileSync(fileURLToPath(new URL('../supabase/tests/remote-rls.sql', import.meta.url)), 'utf8')
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || 'proxy-injected'}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
const text = await res.text()
const passed = text.match(/ALL_PASSED (\d+)/)
if (passed) { console.log(`✓ ${passed[1]} RLS checks passed on ${ref} (rolled back, no data left)`); process.exit(0) }
console.error('✗', text.slice(0, 400))
process.exit(1)
