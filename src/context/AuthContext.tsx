import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createAuthService, type AuthUser, type DemoCapableAuth } from '@/services/auth'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** true بعد فتح رابط استعادة كلمة المرور (حتى يتم تعيين كلمة جديدة). */
  recovery: boolean
  /** true إذا سجّل المستخدم خروجه بنفسه (فلا نعيده لآخر صفحة عند الدخول التالي). */
  signedOutByUser: boolean
  service: DemoCapableAuth
  clearRecovery(): void
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children, service: injected }: { children: ReactNode; service?: DemoCapableAuth }) {
  const [service] = useState<DemoCapableAuth>(() => injected ?? createAuthService())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [recovery, setRecovery] = useState(false)
  const [signedOutByUser, setSignedOutByUser] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = service.onAuthChange((u, event) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setRecovery(false)
        setSignedOutByUser(true)
      }
      if (event === 'SIGNED_IN') setSignedOutByUser(false)
      setUser(u)
      setStatus(u ? 'signedIn' : 'signedOut')
    })
    service.getCurrentUser()
      .then((u) => {
        if (!active) return
        setUser((prev) => prev ?? u)
        setStatus((prev) => (prev === 'loading' ? (u ? 'signedIn' : 'signedOut') : prev))
      })
      .catch(() => active && setStatus('signedOut'))
    return () => {
      active = false
      unsubscribe()
    }
  }, [service])

  const value = useMemo<AuthState>(
    () => ({ status, user, recovery, signedOutByUser, service, clearRecovery: () => setRecovery(false) }),
    [status, user, recovery, signedOutByUser, service],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
