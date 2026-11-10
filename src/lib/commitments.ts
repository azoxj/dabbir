import type { Commitment, CommitmentKind, ExpenseCategory, ISODate } from '@/types/domain'
import { addMonths, daysBetween, daysInMonth } from './dates'

export type DueStatus = 'done' | 'overdue' | 'today' | 'soon' | 'upcoming' | 'later'

export const SOON_DAYS = 3
export const UPCOMING_DAYS = 14

export function dueStatus(c: Pick<Commitment, 'dueDate' | 'done'>, today: ISODate, soonDays: number = SOON_DAYS): DueStatus {
  if (c.done) return 'done'
  const d = daysBetween(today, c.dueDate)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= soonDays) return 'soon'
  if (d <= Math.max(UPCOMING_DAYS, soonDays)) return 'upcoming'
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

/** أقرب تاريخ (اليوم أو بعده) يوافق يومًا معينًا من الشهر، مع مراعاة الأشهر القصيرة. */
export function nextMonthlyDate(today: ISODate, day: number): ISODate {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const thisMonth = Math.min(day, daysInMonth(y, m))
  const pad = (n: number) => String(n).padStart(2, '0')
  if (thisMonth >= d) return `${y}-${pad(m)}-${pad(thisMonth)}`
  return addMonths(`${y}-${pad(m)}-01`, 1, day)
}

/** التكاليف الثابتة = الالتزامات الشهرية المتكررة ذات المبلغ (إيجار، قسط، فواتير ثابتة...). */
export function fixedMonthlyCosts(list: Commitment[]): { items: Commitment[]; total: number } {
  const items = list.filter((c) => c.recurrence === 'monthly' && c.amount && c.amount > 0)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
  return { items, total: items.reduce((s, c) => s + (c.amount ?? 0), 0) }
}
