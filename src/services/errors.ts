/** خطأ برسالة عربية جاهزة للعرض للمستخدم. */
export class AppError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'البريد أو كلمة المرور غير صحيحة.',
  email_not_confirmed: 'لازم تأكد بريدك أولًا. افتح رسالة التأكيد اللي وصلتك.',
  user_already_exists: 'هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.',
  email_exists: 'هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.',
  weak_password: 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع أرقام وحروف.',
  same_password: 'كلمة المرور الجديدة لازم تختلف عن القديمة.',
  over_email_send_rate_limit: 'لأمانك، ما نقدر نرسل رسالة جديدة لنفس البريد الآن. انتظر دقيقة ثم حاول مرة ثانية.',
  over_request_rate_limit: 'طلبات كثيرة. انتظر دقيقة ثم حاول مرة ثانية.',
  session_not_found: 'انتهت الجلسة. سجّل دخولك مرة ثانية.',
  session_expired: 'انتهت الجلسة. سجّل دخولك مرة ثانية.',
  provider_disabled: 'طريقة الدخول هذي غير مفعّلة حاليًا.',
  signup_disabled: 'التسجيل مغلق حاليًا.',
  validation_failed: 'البيانات المدخلة غير صحيحة.',
  network: 'تعذّر الاتصال. تأكد من الإنترنت وحاول مرة ثانية.',
}

export function authErrorMessage(code: string | undefined): string {
  return (code && AUTH_MESSAGES[code]) || 'صار خطأ غير متوقع. حاول مرة ثانية.'
}

export function toAppError(err: unknown, fallbackCode = 'unknown'): AppError {
  if (err instanceof AppError) return err
  const e = err as { code?: string; message?: string; name?: string } | null
  if (e?.name === 'AuthRetryableFetchError' || e?.message === 'Failed to fetch' || e?.name === 'TypeError') {
    return new AppError('network', authErrorMessage('network'))
  }
  const code = e?.code || fallbackCode
  return new AppError(code, authErrorMessage(code))
}

export function dataError(err: unknown): AppError {
  if (err instanceof AppError) return err
  const e = err as { code?: string; message?: string } | null
  if (e?.message === 'Failed to fetch') return new AppError('network', authErrorMessage('network'))
  if (e?.code === '42501' || e?.code === 'PGRST301') return new AppError('forbidden', 'ما عندك صلاحية على هذي البيانات. سجّل دخولك مرة ثانية.')
  if (e?.code === '23514') return new AppError('invalid', 'القيمة المدخلة غير مقبولة.')
  if (e?.code === 'P0002' || e?.code === 'PGRST116') return new AppError('not_found', 'العنصر غير موجود أو تم حذفه.')
  return new AppError(e?.code ?? 'unknown', 'تعذّر حفظ أو تحميل البيانات. حاول مرة ثانية.')
}
