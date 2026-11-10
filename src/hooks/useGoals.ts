import { useCallback } from 'react'
import type { NewSavingsGoal } from '@/types/domain'
import { useAsync } from './useAsync'
import { useRepository } from './useRepository'

export function useGoals() {
  const repo = useRepository()
  const state = useAsync(() => repo.listGoals(), [repo])
  const { reload } = state
  const add = useCallback(async (g: NewSavingsGoal) => {
    await repo.addGoal(g)
    await reload()
  }, [repo, reload])
  const adjust = useCallback(async (id: string, delta: number) => {
    await repo.adjustGoal(id, delta)
    await reload()
  }, [repo, reload])
  const remove = useCallback(async (id: string) => {
    await repo.deleteGoal(id)
    await reload()
  }, [repo, reload])
  return { ...state, add, adjust, remove }
}
