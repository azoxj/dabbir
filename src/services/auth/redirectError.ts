/**
 * أخطاء روابط البريد (تأكيد/استعادة) التي يعيدها خادم المصادقة في الرابط، مثل:
 *   #error=access_denied&error_code=otp_expired&error_description=...
 * نقرؤها مرة واحدة عند التحميل ونحذفها من شريط العنوان.
 */
let pending: string | null = null

const MESSAGES: Record<string, string> = {
  otp_expired: 'الرابط منتهي الصلاحية أو مستخدم من قبل. اطلب رابطًا جديدًا.',
  access_denied: 'تعذّر إكمال العملية من الرابط. اطلب رابطًا جديدًا.',
}

export function captureAuthRedirectError(loc: Location = window.location): void {
  const params = new URLSearchParams(loc.hash.replace(/^#/, '') || loc.search.replace(/^\?/, ''))
  const code = params.get('error_code') ?? params.get('error')
  if (!code) return
  pending = MESSAGES[code] ?? MESSAGES.access_denied!
  window.history.replaceState(null, '', loc.pathname)
}

/** يعيد الرسالة مرة واحدة ثم يمسحها. */
export function takeAuthRedirectError(): string | null {
  const m = pending
  pending = null
  return m
}
