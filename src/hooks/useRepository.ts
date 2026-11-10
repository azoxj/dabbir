import { useContext } from 'react'
import { RepositoryContext } from '@/context/RepositoryContext'
import type { DataRepository } from '@/services/data'

export function useRepository(): DataRepository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('useRepository requires a signed-in user inside <RepositoryProvider>')
  return repo
}
