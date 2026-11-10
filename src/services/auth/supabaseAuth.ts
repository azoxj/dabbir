import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/services/supabaseClient'
import { AppError, toAppError } from '@/services/errors'
import type { AuthEvent, AuthService, AuthUser, SignUpResult } from './types'

function mapUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    email: u.email ?? null,
    displayName: (meta.full_name as string) || (meta.name as string) || (meta.display_name as string) || null,
    provider: u.app_metadata?.provider === 'google' ? 'google' : 'email',
  }
}

/** رابط عودة داخل التطبيق مع مراعاة المسار الأساسي (مثل /dabbir/ على GitHub Pages). */
export const redirectUrl = (path: string, base: string = import.meta.env.BASE_URL) =>
  `${window.location.origin}${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\//, '')}`

export function createSupabaseAuth(): AuthService {
  const sb = getSupabase()
  return {
    mode: 'supabase',
    supportsGoogle: true,

    async getCurrentUser() {
      const { data, error } = await sb.auth.getSession()
      if (error) throw toAppError(error)
      return mapUser(data.session?.user)
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        const map: Record<string, AuthEvent> = {
          SIGNED_IN: 'SIGNED_IN', SIGNED_OUT: 'SIGNED_OUT', PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
          USER_UPDATED: 'USER_UPDATED', INITIAL_SESSION: 'INITIAL', TOKEN_REFRESHED: 'SIGNED_IN',
        }
        // تأجيل الاستدعاء خارج callback الخاص بـ supabase لتجنب deadlock موثّق في المكتبة.
        setTimeout(() => cb(mapUser(session?.user), map[event] ?? 'SIGNED_IN'), 0)
      })
      return () => data.subscription.unsubscribe()
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw toAppError(error, 'invalid_credentials')
    },

    async signUp(email, password, displayName): Promise<SignUpResult> {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectUrl('/'), data: { full_name: displayName.trim() || undefined } },
      })
      if (error) throw toAppError(error)
      // عند تفعيل «Confirm email» ومع بريد مسجّل مسبقًا تعيد Supabase مستخدمًا بلا identities (حماية من كشف الحسابات).
      return { needsEmailConfirmation: !data.session }
    },

    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl('/') } })
      if (error) throw toAppError(error)
    },

    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl('/reset-password') })
      if (error) throw toAppError(error)
    },

    async updatePassword(newPassword) {
      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw toAppError(error)
    },

    async resendConfirmation(email) {
      const { error } = await sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl('/') } })
      if (error) throw toAppError(error)
    },

    async signOut(opts) {
      const { error } = await sb.auth.signOut({ scope: opts?.everywhere ? 'global' : 'local' })
      if (error && error.name !== 'AuthSessionMissingError') throw new AppError('signout', 'تعذّر تسجيل الخروج. حاول مرة ثانية.')
    },
  }
}
