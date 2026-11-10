/**
 * إعدادات الواجهة. القيم هنا عامة بطبيعتها (تُضمَّن في ملفات JavaScript المنشورة).
 * المسموح: Project URL + Publishable/anon key فقط. أي مفتاح سري يُرفض ويعمل التطبيق بالوضع التجريبي.
 */
export type DataMode = 'supabase' | 'demo'

export interface AppConfig {
  mode: DataMode
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  /** سبب العمل بالوضع التجريبي (للعرض في الإعدادات). */
  demoReason: string | null
}

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')))
    return typeof json?.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

/** يعيد true إذا كان المفتاح سريًا (service_role أو sb_secret_) ويجب ألا يصل للمتصفح. */
export function isSecretKey(key: string): boolean {
  const k = key.trim()
  if (k.startsWith('sb_secret_')) return true
  const role = decodeJwtRole(k)
  return role !== null && role !== 'anon'
}

export function isValidSupabaseUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
  } catch {
    return false
  }
}

export function resolveConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): AppConfig {
  const url = env.VITE_SUPABASE_URL?.trim() || ''
  const key = env.VITE_SUPABASE_ANON_KEY?.trim() || ''
  const demo = (reason: string): AppConfig => ({ mode: 'demo', supabaseUrl: null, supabaseAnonKey: null, demoReason: reason })

  if (!url && !key) return demo('لم يتم إعداد Supabase بعد.')
  if (!url || !key) return demo('إعدادات Supabase ناقصة (الرابط أو المفتاح).')
  if (isSecretKey(key)) {
    // لا نطبع المفتاح نفسه أبدًا.
    console.error('[dabbir] رُفض مفتاح سري في VITE_SUPABASE_ANON_KEY. استخدم Publishable/anon key فقط.')
    return demo('تم رفض المفتاح لأنه مفتاح سري (service_role/secret). استخدم المفتاح العام فقط.')
  }
  if (!isValidSupabaseUrl(url)) return demo('رابط Supabase غير صالح (يجب أن يكون https).')
  return { mode: 'supabase', supabaseUrl: url.replace(/\/+$/, ''), supabaseAnonKey: key, demoReason: null }
}

export const appConfig: AppConfig = resolveConfig(import.meta.env)
