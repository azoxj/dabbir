/**
 * المسار الأساسي للتطبيق يُحدد وقت التشغيل لا وقت البناء، لأن نفس النسخة تُخدم من عنوانين:
 *   - https://azoxj.github.io/dabbir/   ← المسار /dabbir/
 *   - https://dabbir.online/            ← الجذر /
 * هذا يسمح بنقل الدومين بدون أي توقف: النسخة تعمل قبل ربط الدومين وبعده.
 */
export const LEGACY_PREFIX = '/dabbir/'

export function detectBase(pathname: string): string {
  return pathname === '/dabbir' || pathname.startsWith(LEGACY_PREFIX) ? LEGACY_PREFIX : '/'
}

export const APP_BASE: string = typeof window === 'undefined' ? '/' : detectBase(window.location.pathname)

/** basename لـ React Router (بدون الشرطة الأخيرة؛ الجذر = ''). */
export const ROUTER_BASENAME = APP_BASE.replace(/\/$/, '')

/** رابط مطلق داخل التطبيق، مثل appUrl('icons/icon-192.png'). */
export const appUrl = (path: string) => `${APP_BASE}${path.replace(/^\//, '')}`
