import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoader } from '@/components/ui'
import { RepositoryProvider } from '@/context/RepositoryContext'
import { useAuth } from '@/hooks/useAuth'

/** الصفحات الخاصة: تتطلب تسجيل دخول، وتوفّر مستودع بيانات المستخدم. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, recovery, signedOutByUser } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageLoader />
  if (status === 'signedOut') return <Navigate to="/login" replace state={signedOutByUser ? null : { from: location.pathname }} />
  // جلسة الاستعادة تذهب مباشرة لتعيين كلمة المرور.
  if (recovery) return <Navigate to="/reset-password" replace />
  return <RepositoryProvider>{children}</RepositoryProvider>
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
