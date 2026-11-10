import { useCallback } from 'react'
import { monthRange } from '@/lib/dates'
import type { ExpenseCategory, ExpensePatch, ISODate, NewExpense, ProfilePatch } from '@/types/domain'
import { useAsync } from './useAsync'
import { useRepository } from './useRepository'

export function useProfile() {
  const repo = useRepository()
  const state = useAsync(() => repo.getProfile(), [repo])
  const { reload } = state
  const update = useCallback(async (patch: ProfilePatch) => {
    await repo.updateProfile(patch)
    await reload()
  }, [repo, reload])
  return { ...state, update }
}

export function useMonthExpenses(today: ISODate) {
  const repo = useRepository()
  const { from, to } = monthRange(today)
  const state = useAsync(() => repo.listExpenses({ from, to }), [repo, from, to])
  const { reload } = state
  const add = useCallback(async (e: NewExpense) => {
    await repo.addExpense(e)
    await reload()
  }, [repo, reload])
  const update = useCallback(async (id: string, patch: ExpensePatch) => {
    await repo.updateExpense(id, patch)
    await reload()
  }, [repo, reload])
  const remove = useCallback(async (id: string) => {
    await repo.deleteExpense(id)
    await reload()
  }, [repo, reload])
  return { ...state, add, update, remove }
}

export function useBudgetLimits() {
  const repo = useRepository()
  const state = useAsync(() => repo.listBudgetLimits(), [repo])
  const { reload } = state
  const set = useCallback(async (category: ExpenseCategory, limit: number | null) => {
    if (limit === null) await repo.removeBudgetLimit(category)
    else await repo.setBudgetLimit(category, limit)
    await reload()
  }, [repo, reload])
  return { ...state, set }
}
