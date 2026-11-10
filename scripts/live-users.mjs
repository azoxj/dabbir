// يولّد حسابي اختبار عشوائيين لاختبار حي على Supabase الحقيقي.
// - كلمات المرور تُكتب فقط في ملف مؤقت داخل الـ runner (LIVE_SECRETS_FILE) ولا تُطبع أبدًا.
// - يُكتب للنشر: البريد + المعرّف + bcrypt hash فقط (LIVE_HASHES_FILE)، وهو ما يُستخدم لإنشاء الحسابين في القاعدة.
import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'

const secretsFile = process.env.LIVE_SECRETS_FILE
const hashesFile = process.env.LIVE_HASHES_FILE
if (!secretsFile || !hashesFile) { console.error('LIVE_SECRETS_FILE and LIVE_HASHES_FILE required'); process.exit(2) }
const run = process.env.GITHUB_RUN_ID ?? `local${Date.now()}`
const users = ['a', 'b'].map((tag) => {
  const password = randomBytes(24).toString('base64url')
  return { tag, id: randomUUID(), email: `live-${run}-${tag}@example.test`, password, hash: bcrypt.hashSync(password, 10) }
})
writeFileSync(secretsFile, users.map((u) => `LIVE_${u.tag.toUpperCase()}_EMAIL=${u.email}\nLIVE_${u.tag.toUpperCase()}_ID=${u.id}\nLIVE_${u.tag.toUpperCase()}_PASSWORD=${u.password}\n`).join(''), { mode: 0o600 })
writeFileSync(hashesFile, JSON.stringify(users.map(({ id, email, hash }) => ({ id, email, hash })), null, 2) + '\n')
console.log('generated', users.map((u) => u.email).join(', '))
