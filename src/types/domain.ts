/** تاريخ محلي بصيغة YYYY-MM-DD (بدون منطقة زمنية). */
export type ISODate = string

export const EXPENSE_CATEGORIES = [
  'housing', 'food', 'transport', 'bills', 'health',
  'education', 'family', 'entertainment', 'shopping', 'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const COMMITMENT_KINDS = ['bill', 'appointment', 'renewal', 'installment', 'other'] as const
export type CommitmentKind = (typeof COMMITMENT_KINDS)[number]

export const RECURRENCES = ['none', 'monthly', 'yearly'] as const
export type Recurrence = (typeof RECURRENCES)[number]

export interface Profile {
  id: string
  displayName: string | null
  monthlyIncome: number
  savingsTarget: number
  /** يوم نزول الراتب (1-31). */
  payday: number
  /** عرض التاريخ الهجري في الرئيسية. */
  showHijri: boolean
  /** كم يومًا قبل الاستحقاق يظهر الالتزام كـ«قريب». */
  alertDays: number
}

export const DEFAULT_PREFERENCES = { showHijri: true, alertDays: 3 } as const
export const ALERT_DAY_OPTIONS = [1, 2, 3, 5, 7, 14] as const

export interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  note: string | null
  spentOn: ISODate
  createdAt: string
}

export interface BudgetLimit {
  category: ExpenseCategory
  monthlyLimit: number
}

export interface Commitment {
  id: string
  title: string
  kind: CommitmentKind
  dueDate: ISODate
  dueTime: string | null
  amount: number | null
  recurrence: Recurrence
  done: boolean
  notes: string | null
}

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: ISODate | null
}

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>
export type ExpensePatch = Partial<NewExpense>
export type NewCommitment = Omit<Commitment, 'id' | 'done'>
export type NewSavingsGoal = Omit<SavingsGoal, 'id'>
export type ProfilePatch = Partial<Omit<Profile, 'id'>>
