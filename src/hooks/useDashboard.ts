import { useMemo } from 'react'
import { monthRange } from '@/lib/dates'
import { buildTodayPlan, type TodayPlan } from '@/lib/todayPlan'
import type { ISODate } from '@/types/domain'
import { useAsync } from './useAsync'
import { useRepository } from './useRepository'

/** يحمّل كل ما تحتاجه اللوحة الرئيسية بالتوازي ثم يبني خطة اليوم محليًا (بدون خادم أو AI). */
export function useDashboard(today: ISODate) {
  const repo = useRepository()
  const { from, to } = monthRange(today)
  const state = useAsync(async () => {
    const [profile, expenses, limits, commitments, goals] = await Promise.all([
      repo.getProfile(),
      repo.listExpenses({ from, to }),
      repo.listBudgetLimits(),
      repo.listCommitments(),
      repo.listGoals(),
    ])
    return { profile, expenses, limits, commitments, goals }
  }, [repo, from, to, today])

  const plan: TodayPlan | undefined = useMemo(
    () => (state.data ? buildTodayPlan({ ...state.data, today }) : undefined),
    [state.data, today],
  )
  return { ...state, plan }
}
