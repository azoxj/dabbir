/* دبّر — Service Worker
 * - يخزّن واجهة التطبيق (app shell) والملفات المبنية للعمل بدون اتصال.
 * - لا يخزّن أي طلب لـ Supabase أو أي نطاق خارجي (بيانات المستخدم لا تُحفظ في الكاش).
 * - قائمة PRECACHE ورقم الإصدار يُحقنان أثناء البناء (vite.config.ts → dabbirPwa).
 */
const VERSION = '__DABBIR_SW_VERSION__'
const PRECACHE = self.__DABBIR_PRECACHE__ || ['/', '/manifest.webmanifest', '/icons/icon-192.png']
const CACHE = `dabbir-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('dabbir-') && k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase/Google: الشبكة مباشرة دائمًا

  // التنقل بين الصفحات (SPA): الشبكة أولًا ثم الواجهة المخزنة عند انقطاع الاتصال.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        if (res.ok) (await caches.open(CACHE)).put('/', res.clone())
        return res
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  // ملفات البناء ذات البصمة (/assets/*) والأيقونات: الكاش أولًا.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cached = await caches.match(req)
      if (cached) return cached
      const res = await fetch(req)
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
      return res
    })())
  }
})
