import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoader } from '@/components/ui'
import { RepositoryProvider } from '@/context/RepositoryContext'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/services/supabaseClient'

/** الصفحات الخاصة: تتطلب تسجيل دخول، وتوفّر مستودع بيانات المستخدم. */
export function ProtectedRoute({ children, allowMfaChallenge = false }: { children: ReactNode; allowMfaChallenge?: boolean }) {
  const { status, recovery, signedOutByUser, service, user } = useAuth()
  const [mfa, setMfa] = useState<'checking' | 'required' | 'ok'>('checking')
  useEffect(() => {
    if (status !== 'signedIn' || service.mode !== 'supabase') return
    let active = true
    const sb = getSupabase()
    void sb.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (!active) return
      if (error || !data) return setMfa('required')
      setMfa(data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'required' : 'ok')
    }).catch(() => active && setMfa('required'))
    return () => { active = false }
  }, [status, service, user?.id])
  const location = useLocation()
  if (status === 'loading') return <PageLoader />
  if (status === 'signedOut') return <Navigate to="/login" replace state={signedOutByUser ? null : { from: location.pathname }} />
  // جلسة الاستعادة تذهب مباشرة لتعيين كلمة المرور.
  if (recovery) return <Navigate to="/reset-password" replace />
  if (service.mode === 'supabase' && mfa === 'checking') return <PageLoader />
  if (service.mode === 'supabase' && mfa === 'required' && !allowMfaChallenge) return <Navigate to="/mfa-challenge" replace />
  return allowMfaChallenge ? <>{children}</> : <RepositoryProvider>{children}</RepositoryProvider>
}

/** صفحات الدخول/التسجيل: إذا كان المستخدم مسجلًا نوجّهه للرئيسية. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status, recovery } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageLoader />
  if (recovery) return <Navigate to="/reset-password" replace />
  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from.startsWith('/') && !from.startsWith('//') ? from : '/'} replace />
  }
  return <>{children}</>
}
