export interface AuthUser {
  id: string
  email: string | null
  displayName: string | null
  provider: 'email' | 'google' | 'demo'
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'INITIAL'

export interface SignUpResult {
  /** true إذا كان التفعيل عبر البريد مطلوبًا قبل الدخول. */
  needsEmailConfirmation: boolean
}

export interface AuthService {
  readonly mode: 'supabase' | 'demo'
  readonly supportsGoogle: boolean
  getCurrentUser(): Promise<AuthUser | null>
  onAuthChange(cb: (user: AuthUser | null, event: AuthEvent) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, displayName: string): Promise<SignUpResult>
  signInWithGoogle(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updatePassword(newPassword: string): Promise<void>
  signOut(): Promise<void>
}

export const MIN_PASSWORD_LENGTH = 8

export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `كلمة المرور لازم تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`
  if (pw.length > 72) return 'كلمة المرور طويلة جدًا (72 حرفًا كحد أقصى).'
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return 'استخدم حروفًا وأرقامًا في كلمة المرور.'
  return null
}

export function validateEmail(email: string): string | null {
  const e = email.trim()
  if (!e) return 'اكتب بريدك الإلكتروني.'
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'صيغة البريد غير صحيحة.'
  return null
}
