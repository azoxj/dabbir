// خادم محلي يحاكي سلوك GitHub Pages لمستودع مشروع:
// - الملفات تحت /<repo>/ فقط.
// - أي مسار غير موجود ← 404.html بحالة 404 (هكذا يعمل تحديث الصفحة في تطبيق SPA على Pages).
// - /<repo> بدون شرطة ← تحويل 301 إلى /<repo>/
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
}

export function startPagesServer({ root, base = '/dabbir/', port = 4180, redirect = null }) {
  const state = { redirect }
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    // محاكاة GitHub Pages بعد ربط دومين مخصص: الرابط القديم يحوّل 301 إلى الدومين مع الحفاظ على المسار.
    if (state.redirect) {
      const rest = path.startsWith(base) ? path.slice(base.length) : path === base.slice(0, -1) ? '' : path.replace(/^\//, '')
      res.writeHead(301, { Location: `${state.redirect.replace(/\/$/, '')}/${rest}${new URL(req.url, 'http://x').search}` })
      return res.end()
    }
    if (path === base.slice(0, -1)) { res.writeHead(301, { Location: base }); return res.end() }
    const send = async (file, status = 200) => {
      const body = await readFile(file) // اقرأ أولًا: إن فشلت القراءة لا تُرسل رؤوس
      res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(body)
    }
    if (path.startsWith(base)) {
      let rel = normalize(path.slice(base.length))
      if (rel.startsWith('..')) { res.writeHead(400); return res.end() }
      if (rel === '.' || rel.endsWith('/')) rel = join(rel, 'index.html')
      const file = join(root, rel)
      try {
        if ((await stat(file)).isFile()) return await send(file)
      } catch { /* ← 404 */ }
    }
    try {
      return await send(join(root, '404.html'), 404)
    } catch {
      // بدون 404.html يعرض GitHub Pages صفحة 404 الخاصة به.
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('404 File not found (GitHub Pages)')
    }
  })
  server.setRedirect = (target) => { state.redirect = target }
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}
