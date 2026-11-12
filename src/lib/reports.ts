/** حسابات التقارير — دوال نقية بدون شبكة أو AI. */
import type { Expense, ExpenseCategory, ISODate, SavingsGoal } from '@/types/domain'
import { addMonths, daysBetween, monthRange } from './dates'
import { roundMoney } from './money'

export interface MonthTotal { month: string; from: ISODate; to: ISODate; total: number; count: number }

/** إجمالي المصروف لكل شهر لآخر n أشهر (من الأقدم للأحدث)، شامل الشهر الحالي. */
export function monthlyTotals(expenses: Expense[], today: ISODate, n = 6): MonthTotal[] {
  const firstOfThis = monthRange(today).from
  const out: MonthTotal[] = []
  for (let i = n - 1; i >= 0; i--) {
    const { from, to } = monthRange(addMonths(firstOfThis, -i))
    const list = expenses.filter((e) => e.spentOn >= from && e.spentOn <= to)
    out.push({ month: from.slice(0, 7), from, to, total: roundMoney(list.reduce((s, e) => s + e.amount, 0)), count: list.length })
  }
  return out
}

export function reportRange(today: ISODate, n = 6): { from: ISODate; to: ISODate } {
  const firstOfThis = monthRange(today).from
  return { from: addMonths(firstOfThis, -(n - 1)), to: monthRange(today).to }
}

export function categoryTotals(expenses: Expense[], from: ISODate, to: ISODate): { category: ExpenseCategory; total: number; share: number }[] {
  const map = new Map<ExpenseCategory, number>()
  let sum = 0
  for (const e of expenses) {
    if (e.spentOn < from || e.spentOn > to) continue
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    sum += e.amount
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total: roundMoney(total), share: sum > 0 ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total)
}

export interface MonthComparison {
  current: number
  previous: number
  /** التغير النسبي عن الشهر السابق (null إذا لا يوجد صرف سابق). */
  change: number | null
  /** متوسط الصرف اليومي في الشهر الحالي حتى اليوم. */
  dailyAverage: number
}

export function compareWithPreviousMonth(totals: MonthTotal[], today: ISODate): MonthComparison {
  const current = totals.at(-1)?.total ?? 0
  const previous = totals.at(-2)?.total ?? 0
  const daysSoFar = daysBetween(monthRange(today).from, today) + 1
  return {
    current,
    previous,
    change: previous > 0 ? (current - previous) / previous : null,
    dailyAverage: roundMoney(current / daysSoFar),
  }
}

export function savingsSummary(goals: SavingsGoal[]): { saved: number; target: number; ratio: number; completed: number } {
  const saved = goals.reduce((s, g) => s + g.currentAmount, 0)
  const target = goals.reduce((s, g) => s + g.targetAmount, 0)
  return {
    saved: roundMoney(saved),
    target: roundMoney(target),
    ratio: target > 0 ? Math.min(1, saved / target) : 0,
    completed: goals.filter((g) => g.currentAmount >= g.targetAmount).length,
  }
}

const monthName = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'short' })
const monthYear = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' })
export const formatMonthShort = (m: string) => monthName.format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 15))
export const formatMonthLong = (m: string) => monthYear.format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 15))
