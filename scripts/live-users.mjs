// يولّد حسابي اختبار عشوائيين لاختبار حي على Supabase الحقيقي.
// يطبع في السجل: البريد + المعرّف + bcrypt hash فقط (لا كلمات المرور).
// كلمات المرور تُمرَّر لخطوة الاختبار عبر GITHUB_OUTPUT مع إخفائها من السجلات.
import { randomBytes, randomUUID } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'

const run = process.env.GITHUB_RUN_ID ?? `local${Date.now()}`
const users = ['a', 'b'].map((tag) => {
  const password = randomBytes(24).toString('base64url')
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${password}`)
  return { tag, id: randomUUID(), email: `live-${run}-${tag}@example.test`, password, hash: bcrypt.hashSync(password, 10) }
})
console.log('LIVE_USERS ' + JSON.stringify(users.map(({ id, email, hash }) => ({ id, email, hash }))))
if (process.env.GITHUB_OUTPUT) {
  for (const u of users) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${u.tag}_email=${u.email}\n${u.tag}_id=${u.id}\n${u.tag}_password=${u.password}\n`)
  }
}
