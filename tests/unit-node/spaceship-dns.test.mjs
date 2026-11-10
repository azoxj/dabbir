// اختبار سكربت Spaceship DNS على خادم وهمي محلي يطابق شكل الـ API.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
let records = [
  { type: 'A', name: '@', address: '162.255.119.10', ttl: 1800 },          // صفحة الركن الافتراضية → تُستبدل
  { type: 'CNAME', name: 'www', cname: 'parkingpage.namecheap.com', ttl: 1800 },
  { type: 'MX', name: '@', exchange: 'mx1.example.net', preference: 10, ttl: 3600 }, // بريد → لا يُمس
  { type: 'TXT', name: '@', value: 'v=spf1 include:example.net ~all', ttl: 3600 },
  { type: 'A', name: '@', address: '185.199.108.153', ttl: 3600 },         // صحيح مسبقًا → يبقى
]
const calls = []
const server = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    calls.push({ method: req.method, url: req.url, key: req.headers['x-api-key'], secret: req.headers['x-api-secret'], body: body && JSON.parse(body) })
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ items: records, total: records.length })) }
    if (req.method === 'DELETE') { const del = JSON.parse(body); records = records.filter((r) => !del.some((d) => d.type === r.type && d.name === r.name && (d.address ?? d.cname) === (r.address ?? r.cname))); res.writeHead(204); return res.end() }
    if (req.method === 'PUT') { records.push(...JSON.parse(body).items); res.writeHead(204); return res.end() }
  })
})
await new Promise((r) => server.listen(0, r))
const env = { ...process.env, SPACESHIP_API_BASE: `http://127.0.0.1:${server.address().port}`, SPACESHIP_API_KEY: 'test-key', SPACESHIP_API_SECRET: 'test-secret' }
// spawn غير متزامن: الخادم الوهمي يعمل في نفس العملية ولا يجب حجب حلقة الأحداث.
const run = (mode) => new Promise((resolve) => {
  const p = spawn(process.execPath, ['scripts/spaceship-dns.mjs', mode], { cwd: root, env })
  let stdout = '', stderr = ''
  p.stdout.on('data', (d) => { stdout += d }); p.stderr.on('data', (d) => { stderr += d })
  p.on('close', (status) => resolve({ status, stdout, stderr }))
})

const plan = await run('plan')
assert.equal(plan.status, 0, plan.stderr)
assert.equal(calls.filter((c) => c.method !== 'GET').length, 0, 'plan must not write')
assert.match(plan.stdout, /− حذف .*162\.255\.119\.10/)
assert.match(plan.stdout, /لا يُمس.*MX/)

const apply = await run('apply')
assert.equal(apply.status, 0, apply.stderr)
const del = calls.find((c) => c.method === 'DELETE')
assert.deepEqual(del.body.map((r) => `${r.type} ${r.name}`).sort(), ['A @', 'CNAME www'])
const put = calls.find((c) => c.method === 'PUT')
assert.equal(put.body.force, true)
assert.equal(put.body.items.length, 8, 'adds 3 A + 4 AAAA + www CNAME (one A already present)')
assert.ok(calls.every((c) => c.key === 'test-key' && c.secret === 'test-secret'), 'auth headers sent')
assert.ok(records.some((r) => r.type === 'MX') && records.some((r) => r.type === 'TXT'), 'mail records untouched')
assert.ok(!records.some((r) => r.address === '162.255.119.10'), 'parking record removed')
assert.equal(records.filter((r) => r.name === '@' && r.type === 'A').length, 4)

const again = await run('plan')
assert.match(again.stdout, /لا يلزم أي تغيير/, 'idempotent')
server.close()
console.log('✓ spaceship-dns: plan is read-only, apply replaces only web records, mail records untouched, idempotent')
