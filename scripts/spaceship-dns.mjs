// ضبط سجلات DNS في Spaceship عبر API الرسمية (https://spaceship.dev/api/v1).
//   node scripts/spaceship-dns.mjs plan  [ops/dns-dabbir.online.json]   ← يعرض الفروقات فقط
//   node scripts/spaceship-dns.mjs apply [ops/dns-dabbir.online.json]   ← يطبّق
// المصادقة: ترويستا X-API-Key و X-API-Secret (مفتاح من Spaceship API Manager بصلاحيات dnsrecords:read/write).
//   في جلسات Claude يحقنهما الـ proxy تلقائيًا؛ محليًا: SPACESHIP_API_KEY / SPACESHIP_API_SECRET. لا تُطبعان أبدًا.
// الأمان: لا يمس إلا الأنواع المذكورة في replaceTypesFor للأسماء المحددة (مثل A/AAAA/CNAME لـ @ و www).
//   سجلات البريد (MX/TXT) وغيرها لا تُحذف أبدًا.
import { readFileSync } from 'node:fs'

const API = process.env.SPACESHIP_API_BASE || 'https://spaceship.dev/api/v1' // التجاوز للاختبار المحلي فقط
const mode = process.argv[2]
const file = process.argv[3] ?? new URL('../ops/dns-dabbir.online.json', import.meta.url)
if (!['plan', 'apply'].includes(mode)) { console.log('usage: plan|apply [records.json]'); process.exit(2) }
const spec = JSON.parse(readFileSync(file, 'utf8'))
const headers = {
  'X-API-Key': process.env.SPACESHIP_API_KEY || 'proxy-injected',
  'X-API-Secret': process.env.SPACESHIP_API_SECRET || 'proxy-injected',
  'Content-Type': 'application/json',
}

async function call(method, path, body) {
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const value = (r) => (r.address ?? r.cname ?? r.value ?? r.aliasName ?? r.exchange ?? '').toLowerCase().replace(/\.$/, '')
const key = (r) => `${r.type}|${r.name.toLowerCase()}|${value(r)}`

const existing = []
for (let skip = 0; ; skip += 500) {
  const page = await call('GET', `/dns/records/${spec.domain}?take=500&skip=${skip}`)
  existing.push(...(page.items ?? []))
  if ((page.items ?? []).length < 500) break
}
const wanted = new Set(spec.records.map(key))
const managed = (r) => (spec.replaceTypesFor[r.name.toLowerCase()] ?? []).includes(r.type)
const toDelete = existing.filter((r) => managed(r) && !wanted.has(key(r)))
const have = new Set(existing.map(key))
const toAdd = spec.records.filter((r) => !have.has(key(r)))

console.log(`• ${spec.domain}: ${existing.length} سجل حاليًا`)
for (const r of existing) console.log(`   ${managed(r) ? (toDelete.includes(r) ? '− حذف ' : '= يبقى') : '  لا يُمس'}  ${r.type.padEnd(5)} ${r.name.padEnd(6)} ${value(r)}`)
for (const r of toAdd) console.log(`   + إضافة ${r.type.padEnd(5)} ${r.name.padEnd(6)} ${value(r)}`)
if (!toDelete.length && !toAdd.length) { console.log('✓ لا يلزم أي تغيير'); process.exit(0) }
if (mode === 'plan') process.exit(0)

if (toDelete.length) await call('DELETE', `/dns/records/${spec.domain}`, toDelete)
if (toAdd.length) await call('PUT', `/dns/records/${spec.domain}`, { force: true, items: toAdd })
console.log(`✓ تم: حذف ${toDelete.length}، إضافة ${toAdd.length}`)
