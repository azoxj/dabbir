import { useCallback } from 'react'
import { commitmentExpenseCategory, completionPatch } from '@/lib/commitments'
import type { Commitment, ISODate, NewCommitment } from '@/types/domain'
import { useAsync } from './useAsync'
import { useRepository } from './useRepository'

export function useCommitments() {
  const repo = useRepository()
  const state = useAsync(() => repo.listCommitments(), [repo])
  const { reload } = state
  const add = useCallback(async (c: NewCommitment) => {
    await repo.addCommitment(c)
    await reload()
  }, [repo, reload])
  /**
   * «تم»: لمرة واحدة ← منجز، متكرر ← ينتقل للموعد القادم.
   * logExpense: يسجّل مبلغ الالتزام كمصروف اليوم (حتى لا يُحسب مرتين: كالتزام باقٍ وكمصروف غير مسجّل).
   */
  const complete = useCallback(async (c: Commitment, opts: { logExpense?: boolean; today?: ISODate } = {}) => {
    const patch = completionPatch(c)
    await repo.updateCommitment(c.id, patch)
    if (opts.logExpense && c.amount && opts.today) {
      await repo.addExpense({ amount: c.amount, category: commitmentExpenseCategory(c.kind), note: c.title.slice(0, 200), spentOn: opts.today })
    }
    await reload()
    return patch
  }, [repo, reload])
  const update = useCallback(async (id: string, patch: Partial<Omit<Commitment, 'id'>>) => {
    await repo.updateCommitment(id, patch)
    await reload()
  }, [repo, reload])
  const reopen = useCallback(async (id: string) => {
    await repo.updateCommitment(id, { done: false })
    await reload()
  }, [repo, reload])
  const remove = useCallback(async (id: string) => {
    await repo.deleteCommitment(id)
    await reload()
  }, [repo, reload])
  return { ...state, add, update, complete, reopen, remove }
}
