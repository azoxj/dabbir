import { daysBetween } from '@/lib/dates'
import type { Commitment, ISODate, SavingsGoal } from '@/types/domain'

export interface FinanceReminder { id: string; title: string; detail: string; dueDate: ISODate }
export function dueReminders(today: ISODate, commitments: Commitment[], goals: SavingsGoal[], alertDays: number): FinanceReminder[] {
  const results: FinanceReminder[] = []
  for (const item of commitments) {
    if (item.done) continue
    const days = daysBetween(today, item.dueDate)
    if (days <= alertDays) results.push({ id: `commitment:${item.id}:${item.dueDate}`, title: `التزام: ${item.title}`, detail: days < 0 ? 'متأخر عن موعده' : days === 0 ? 'موعده اليوم' : `باقي ${days} يوم`, dueDate: item.dueDate })
  }
  for (const goal of goals) {
    if (!goal.targetDate || goal.currentAmount >= goal.targetAmount) continue
    const days = daysBetween(today, goal.targetDate)
    if (days <= alertDays) results.push({ id: `goal:${goal.id}:${goal.targetDate}`, title: `هدف ادخار: ${goal.name}`, detail: days < 0 ? 'تجاوز الموعد المستهدف' : days === 0 ? 'موعد الهدف اليوم' : `باقي ${days} يوم`, dueDate: goal.targetDate })
  }
  return results.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
