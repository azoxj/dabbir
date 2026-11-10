/**
 * وضع التشغيل الفعلي:
 * - 'supabase': حسابات حقيقية على Supabase (عند توفر الإعدادات).
 * - 'demo': بيانات تجريبية محلية في هذا المتصفح فقط — بدون أي اتصال بـ Supabase.
 * عند توفر Supabase يمكن للزائر الدخول للوضع التجريبي صراحةً، ويبقى منفصلًا تمامًا:
 * مفاتيح تخزين مختلفة (dabbir.demo.*)، ومستودع بيانات مختلف، ولا يُنشأ عميل Supabase أصلًا.
 */
import { appConfig, type DataMode } from './env'

const DEMO_FLAG = 'dabbir.demo.active'

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

export function getRuntimeMode(): DataMode {
  if (appConfig.mode === 'demo') return 'demo'
  return readFlag() ? 'demo' : 'supabase'
}

/** هل يمكن الرجوع من الوضع التجريبي إلى الحسابات الحقيقية؟ */
export const realAccountsAvailable = appConfig.mode === 'supabase'

/** الدخول للوضع التجريبي (إعادة تحميل كاملة حتى لا تختلط حالة الحسابين في الذاكرة). */
export function enterDemoMode(): void {
  try { window.localStorage.setItem(DEMO_FLAG, '1') } catch { /* تخزين غير متاح */ }
  window.location.assign(`${import.meta.env.BASE_URL}login?demo=1`)
}

export function exitDemoMode(): void {
  try { window.localStorage.removeItem(DEMO_FLAG) } catch { /* تخزين غير متاح */ }
  window.location.assign(`${import.meta.env.BASE_URL}login`)
}
