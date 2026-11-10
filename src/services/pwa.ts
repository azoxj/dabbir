/** تسجيل Service Worker وإبلاغ الواجهة عند توفر إصدار جديد (بدون تحديث مفاجئ أثناء الاستخدام). */
type Listener = (reg: ServiceWorkerRegistration) => void
const listeners = new Set<Listener>()
let waiting: ServiceWorkerRegistration | null = null

export function onUpdateAvailable(cb: Listener): () => void {
  listeners.add(cb)
  if (waiting) cb(waiting)
  return () => listeners.delete(cb)
}

function notify(reg: ServiceWorkerRegistration) {
  waiting = reg
  listeners.forEach((l) => l(reg))
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      // في أول تثبيت لا يوجد controller؛ clients.claim() يطلق controllerchange ولا نريد إعادة تحميل وقتها.
      const hadController = !!navigator.serviceWorker.controller
      const base = import.meta.env.BASE_URL
      const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      if (reg.waiting && navigator.serviceWorker.controller) notify(reg)
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) notify(reg)
        })
      })
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return
        reloading = true
        window.location.reload()
      })
    } catch (e) {
      console.warn('[dabbir] service worker registration failed', e)
    }
  })
}

export function applyUpdate(reg: ServiceWorkerRegistration): void {
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
}
