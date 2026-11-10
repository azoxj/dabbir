import type { ISODate, SavingsGoal } from '@/types/domain'
import { daysBetween, monthsBetween } from './dates'
import { roundMoney } from './money'

export type GoalStatus = 'done' | 'no_date' | 'on_track' | 'past_due'

export interface GoalProgress {
  ratio: number
  remaining: number
  monthsLeft: number | null
  /** المبلغ الشهري المطلوب للوصول في الموعد. */
  monthlyNeeded: number | null
  status: GoalStatus
}

export function goalProgress(g: SavingsGoal, today: ISODate): GoalProgress {
  const remaining = roundMoney(Math.max(0, g.targetAmount - g.currentAmount))
  const ratio = g.targetAmount > 0 ? Math.min(1, g.currentAmount / g.targetAmount) : 0
  if (remaining === 0) return { ratio: 1, remaining: 0, monthsLeft: null, monthlyNeeded: null, status: 'done' }
  if (!g.targetDate) return { ratio, remaining, monthsLeft: null, monthlyNeeded: null, status: 'no_date' }
  if (daysBetween(today, g.targetDate) < 0) {
    return { ratio, remaining, monthsLeft: 0, monthlyNeeded: remaining, status: 'past_due' }
  }
  // على الأقل شهر واحد حتى لا ينفجر المبلغ الشهري لهدف قريب جدًا.
  const monthsLeft = Math.max(1, monthsBetween(today, g.targetDate))
  return {
    ratio,
    remaining,
    monthsLeft: Math.round(monthsLeft * 10) / 10,
    monthlyNeeded: roundMoney(Math.ceil(remaining / monthsLeft)),
    status: 'on_track',
  }
}
