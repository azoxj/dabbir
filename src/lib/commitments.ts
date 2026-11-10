import type { Commitment, CommitmentKind, ExpenseCategory, ISODate } from '@/types/domain'
import { addMonths, daysBetween } from './dates'

export type DueStatus = 'done' | 'overdue' | 'today' | 'soon' | 'upcoming' | 'later'

export const SOON_DAYS = 3
export const UPCOMING_DAYS = 14

export function dueStatus(c: Pick<Commitment, 'dueDate' | 'done'>, today: ISODate): DueStatus {
  if (c.done) return 'done'
  const d = daysBetween(today, c.dueDate)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= SOON_DAYS) return 'soon'
  if (d <= UPCOMING_DAYS) return 'upcoming'
  return 'later'
}

export function nextOccurrence(c: Pick<Commitment, 'dueDate' | 'recurrence'>): ISODate | null {
  if (c.recurrence === 'monthly') return addMonths(c.dueDate, 1)
  if (c.recurrence === 'yearly') return addMonths(c.dueDate, 12)
  return null
}

/**
 * ما يحدث عند «تم»: الالتزام لمرة واحدة يُعلَّم منجزًا، والمتكرر ينتقل لموعده القادم
 * (بعد الموعد الحالي، وليس بعد اليوم — حتى لا تضيع دورة متأخرة).
 */
export function completionPatch(c: Commitment): Pick<Commitment, 'done'> | Pick<Commitment, 'dueDate'> {
  const next = nextOccurrence(c)
  return next ? { dueDate: next } : { done: true }
}

export function sortCommitments(list: Commitment[]): Commitment[] {
  return [...list].sort((a, b) =>
    Number(a.done) - Number(b.done)
    || a.dueDate.localeCompare(b.dueDate)
    || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
    || a.title.localeCompare(b.title, 'ar'))
}

/** مجموع المبالغ المستحقة غير المنجزة حتى نهاية فترة (شاملة المتأخر). */
export function amountDueUntil(list: Commitment[], until: ISODate): number {
  return list
    .filter((c) => !c.done && c.amount && c.dueDate <= until)
    .reduce((s, c) => s + (c.amount ?? 0), 0)
}

/** فئة المصروف المقابلة عند تسجيل التزام منجز كمصروف. */
export function commitmentExpenseCategory(kind: CommitmentKind): ExpenseCategory {
  return kind === 'bill' ? 'bills' : 'other'
}
