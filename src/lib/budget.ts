import type { BudgetLimit, Commitment, Expense, ExpenseCategory, ISODate } from '@/types/domain'
import { EXPENSE_CATEGORIES } from '@/types/domain'
import { daysLeftInMonth, monthElapsedRatio, monthRange } from './dates'
import { roundMoney } from './money'

export type LimitStatus = 'none' | 'ok' | 'near' | 'over'

export interface CategorySummary {
  category: ExpenseCategory
  spent: number
  limit: number | null
  ratio: number | null
  status: LimitStatus
}

export interface MonthSummary {
  income: number
  savingsTarget: number
  spent: number
  /** الدخل − المصروف */
  remaining: number
  /** مبالغ الالتزامات غير المنجزة المستحقة حتى نهاية الشهر (شامل المتأخر) — مثل الإيجار والقسط في النسخة القديمة. */
  pendingCommitments: number
  /** الدخل − المصروف − الالتزامات المتبقية */
  availableAfterCommitments: number
  /** الدخل − المصروف − الالتزامات المتبقية − هدف الادخار */
  availableAfterSavings: number
  /** (المصروف + الالتزامات المتبقية) ÷ الدخل — يعادل «نسبة المصاريف إلى الدخل» في النسخة القديمة. */
  committedRatio: number
  spentRatio: number
  elapsedRatio: number
  /** مقدار ما يمكن صرفه يوميًا لبقية الشهر مع الحفاظ على هدف الادخار. */
  dailyAllowance: number
  daysLeft: number
  pace: 'ok' | 'fast' | 'no_income'
  categories: CategorySummary[]
}

export const NEAR_LIMIT_RATIO = 0.8
export const FAST_PACE_MARGIN = 0.15
/** من النسخة القديمة: تنبيه إذا استهلكت المصاريف 85% أو أكثر من الدخل. */
export const HIGH_SPEND_RATIO = 0.85

export function expensesInMonth(expenses: Expense[], today: ISODate): Expense[] {
  const { from, to } = monthRange(today)
  return expenses.filter((e) => e.spentOn >= from && e.spentOn <= to)
}

export function limitStatus(spent: number, limit: number | null): LimitStatus {
  if (!limit || limit <= 0) return 'none'
  if (spent > limit) return 'over'
  if (spent >= limit * NEAR_LIMIT_RATIO) return 'near'
  return 'ok'
}

export function summarizeMonth(input: {
  income: number
  savingsTarget: number
  expenses: Expense[]
  limits: BudgetLimit[]
  today: ISODate
  commitments?: Commitment[]
}): MonthSummary {
  const monthExpenses = expensesInMonth(input.expenses, input.today)
  const income = Math.max(0, input.income)
  const savingsTarget = Math.max(0, input.savingsTarget)

  const byCat = new Map<ExpenseCategory, number>()
  for (const e of monthExpenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
  const limitMap = new Map(input.limits.map((l) => [l.category, l.monthlyLimit]))

  const spent = roundMoney(monthExpenses.reduce((s, e) => s + e.amount, 0))
  const remaining = roundMoney(income - spent)
  const { to: monthEnd } = monthRange(input.today)
  const pendingCommitments = roundMoney((input.commitments ?? [])
    .filter((c) => !c.done && c.amount && c.dueDate <= monthEnd)
    .reduce((s, c) => s + (c.amount ?? 0), 0))
  const availableAfterCommitments = roundMoney(remaining - pendingCommitments)
  const availableAfterSavings = roundMoney(availableAfterCommitments - savingsTarget)
  const elapsedRatio = monthElapsedRatio(input.today)
  const spentRatio = income > 0 ? spent / income : 0
  const committedRatio = income > 0 ? (spent + pendingCommitments) / income : 0
  const daysLeft = daysLeftInMonth(input.today)

  const categories: CategorySummary[] = EXPENSE_CATEGORIES
    .filter((c) => byCat.has(c) || limitMap.has(c))
    .map((category) => {
      const catSpent = roundMoney(byCat.get(category) ?? 0)
      const limit = limitMap.get(category) ?? null
      return {
        category,
        spent: catSpent,
        limit,
        ratio: limit ? catSpent / limit : null,
        status: limitStatus(catSpent, limit),
      }
    })
    .sort((a, b) => b.spent - a.spent)

  // نسبة الصرف المتوقعة حتى اليوم = (دخل − ادخار) × نسبة الأيام المنقضية.
  const spendable = income - savingsTarget
  const pace: MonthSummary['pace'] =
    income <= 0 ? 'no_income'
      : spendable > 0 && spent > spendable * (elapsedRatio + FAST_PACE_MARGIN) ? 'fast'
        : 'ok'

  return {
    income,
    savingsTarget,
    spent,
    remaining,
    pendingCommitments,
    availableAfterCommitments,
    availableAfterSavings,
    committedRatio,
    spentRatio,
    elapsedRatio,
    dailyAllowance: roundMoney(Math.max(0, availableAfterSavings) / daysLeft),
    daysLeft,
    pace,
    categories,
  }
}
