import { createContext, useMemo, type ReactNode } from 'react'
import { createRepository, type DataRepository } from '@/services/data'
import { useAuth } from '@/hooks/useAuth'

export const RepositoryContext = createContext<DataRepository | null>(null)

/** يوفّر مستودع البيانات للمستخدم الحالي. يُعاد إنشاؤه عند تغيّر المستخدم (لا تختلط بيانات حسابين). */
export function RepositoryProvider({ children, repository }: { children: ReactNode; repository?: DataRepository }) {
  const { user } = useAuth()
  const repo = useMemo(() => repository ?? (user ? createRepository(user) : null), [repository, user])
  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>
}
