/**
 * نسخة احتياطية لبيانات المستخدم (ملف JSON) — للتصدير والاستيراد يدويًا.
 * أهم استخدام: نقل بيانات الوضع التجريبي بين عنوانين مختلفين
 * (azoxj.github.io ← dabbir.online)، لأن تخزين المتصفح مرتبط بالعنوان ولا ينتقل تلقائيًا.
 * الاستيراد يتحقق من كل حقل ويرفض الملفات غير الصالحة أو الكبيرة جدًا، ولا يحذف أي بيانات موجودة (يضيف فقط).
 */
import type { DataRepository } from '@/services/data/types'
import {
  COMMITMENT_KINDS, EXPENSE_CATEGORIES, RECURRENCES,
  type BudgetLimit, type Commitment, type Expense, type Profile, type SavingsGoal,
} from '@/types/domain'
import { isISODate } from './dates'
import { MAX_AMOUNT, roundMoney } from './money'

export const BACKUP_FORMAT = 'dabbir-backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
const MAX_ITEMS = 20_000

export interface BackupData {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  profile: Pick<Profile, 'displayName' | 'monthlyIncome' | 'savingsTarget' | 'payday'>
  expenses: Omit<Expense, 'id' | 'createdAt'>[]
  limits: BudgetLimit[]
  commitments: Omit<Commitment, 'id'>[]
  goals: Omit<SavingsGoal, 'id'>[]
}

export async function exportBackup(repo: DataRepository, now: Date = new Date()): Promise<BackupData> {
  const [profile, expenses, limits, commitments, goals] = await Promise.all([
    repo.getProfile(),
    repo.listExpenses({ from: '1900-01-01', to: '2999-12-31' }),
    repo.listBudgetLimits(),
    repo.listCommitments(),
    repo.listGoals(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    profile: { displayName: profile.displayName, monthlyIncome: profile.monthlyIncome, savingsTarget: profile.savingsTarget, payday: profile.payday },
    expenses: expenses.map(({ amount, category, note, spentOn }) => ({ amount, category, note, spentOn })),
    limits,
    commitments: commitments.map((c) => ({ title: c.title, kind: c.kind, dueDate: c.dueDate, dueTime: c.dueTime, amount: c.amount, recurrence: c.recurrence, done: c.done, notes: c.notes })),
    goals: goals.map((g) => ({ name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate })),
  }
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const amount = (v: unknown, allowZero = false): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_AMOUNT || (!allowZero && v === 0)) throw new BackupError('مبلغ غير صالح في الملف')
  return roundMoney(v)
}
const text = (v: unknown, max: number, required = false): string | null => {
  if (v === null || v === undefined || v === '') {
    if (required) throw new BackupError('نص مطلوب مفقود في الملف')
    return null
  }
  if (typeof v !== 'string') throw new BackupError('نص غير صالح في الملف')
  return v.slice(0, max)
}
const date = (v: unknown): string => {
  if (typeof v !== 'string' || !isISODate(v)) throw new BackupError('تاريخ غير صالح في الملف')
  return v
}
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T => {
  if (typeof v !== 'string' || !list.includes(v as T)) throw new BackupError('قيمة غير معروفة في الملف')
  return v as T
}
const list = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new BackupError('بنية الملف غير صحيحة')
  if (v.length > MAX_ITEMS) throw new BackupError('الملف يحتوي عناصر أكثر من المسموح')
  return v
}

/** يتحقق من الملف بالكامل قبل أي كتابة. */
export function parseBackup(raw: string): BackupData {
  if (raw.length > MAX_BACKUP_BYTES) throw new BackupError('الملف كبير جدًا')
  let d: unknown
  try {
    d = JSON.parse(raw)
  } catch {
    throw new BackupError('الملف ليس نسخة احتياطية صالحة (JSON)')
  }
  if (!isObj(d) || d.format !== BACKUP_FORMAT) throw new BackupError('هذا الملف ليس نسخة احتياطية من دبّر')
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) throw new BackupError('إصدار النسخة الاحتياطية غير مدعوم')
  const p = isObj(d.profile) ? d.profile : {}
  const payday = typeof p.payday === 'number' && Number.isInteger(p.payday) && p.payday >= 1 && p.payday <= 31 ? p.payday : 27
  return {
    format: BACKUP_FORMAT,
    version: d.version,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : '',
    profile: {
      displayName: text(p.displayName, 80),
      monthlyIncome: p.monthlyIncome === undefined ? 0 : amount(p.monthlyIncome, true),
      savingsTarget: p.savingsTarget === undefined ? 0 : amount(p.savingsTarget, true),
      payday,
    },
    expenses: list(d.expenses).map((e) => {
      if (!isObj(e)) throw new BackupError('مصروف غير صالح')
      return { amount: amount(e.amount), category: oneOf(e.category, EXPENSE_CATEGORIES), note: text(e.note, 200), spentOn: date(e.spentOn) }
    }),
    limits: list(d.limits).map((l) => {
      if (!isObj(l)) throw new BackupError('حد ميزانية غير صالح')
      return { category: oneOf(l.category, EXPENSE_CATEGORIES), monthlyLimit: amount(l.monthlyLimit) }
    }),
    commitments: list(d.commitments).map((c) => {
      if (!isObj(c)) throw new BackupError('التزام غير صالح')
      const time = c.dueTime === null || c.dueTime === undefined ? null : typeof c.dueTime === 'string' && /^\d{2}:\d{2}$/.test(c.dueTime) ? c.dueTime : null
      return {
        title: text(c.title, 120, true)!, kind: oneOf(c.kind, COMMITMENT_KINDS), dueDate: date(c.dueDate), dueTime: time,
        amount: c.amount === null || c.amount === undefined ? null : amount(c.amount, true),
        recurrence: oneOf(c.recurrence, RECURRENCES), done: c.done === true, notes: text(c.notes, 500),
      }
    }),
    goals: list(d.goals).map((g) => {
      if (!isObj(g)) throw new BackupError('هدف غير صالح')
      return { name: text(g.name, 100, true)!, targetAmount: amount(g.targetAmount), currentAmount: amount(g.currentAmount ?? 0, true), targetDate: g.targetDate ? date(g.targetDate) : null }
    }),
  }
}

/** يضيف محتوى النسخة للحساب الحالي (لا يحذف شيئًا). الملف الشخصي لا يُستبدل إلا في الحقول الفارغة. */
export async function importBackup(repo: DataRepository, b: BackupData): Promise<{ expenses: number; commitments: number; goals: number; limits: number }> {
  const current = await repo.getProfile()
  const patch: Partial<Profile> = {}
  if (!current.displayName && b.profile.displayName) patch.displayName = b.profile.displayName
  if (!current.monthlyIncome && b.profile.monthlyIncome) patch.monthlyIncome = b.profile.monthlyIncome
  if (!current.savingsTarget && b.profile.savingsTarget) patch.savingsTarget = b.profile.savingsTarget
  if (Object.keys(patch).length) await repo.updateProfile({ ...patch, payday: current.monthlyIncome ? current.payday : b.profile.payday })
  for (const e of b.expenses) await repo.addExpense(e)
  const existingLimits = new Set((await repo.listBudgetLimits()).map((l) => l.category))
  for (const l of b.limits) if (!existingLimits.has(l.category)) await repo.setBudgetLimit(l.category, l.monthlyLimit)
  for (const { done, ...c } of b.commitments) {
    const created = await repo.addCommitment(c)
    if (done) await repo.updateCommitment(created.id, { done: true })
  }
  for (const g of b.goals) await repo.addGoal(g)
  return { expenses: b.expenses.length, commitments: b.commitments.length, goals: b.goals.length, limits: b.limits.length }
}
