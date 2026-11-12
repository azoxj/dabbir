/**
 * مستودع بيانات تجريبي في localStorage — مفصول لكل مستخدم بمفتاح خاص به.
 * يحاكي قيود قاعدة البيانات الأساسية (مبالغ موجبة، رصيد الهدف لا ينزل تحت الصفر).
 */
import { AppError } from '@/services/errors'
import { roundMoney } from '@/lib/money'
import { DEFAULT_PREFERENCES, type BudgetLimit, type Commitment, type Expense, type Profile, type SavingsGoal } from '@/types/domain'
import type { DataRepository } from './types'

export interface DemoState {
  profile: Profile
  expenses: Expense[]
  limits: BudgetLimit[]
  commitments: Commitment[]
  goals: SavingsGoal[]
}

export const demoStorageKey = (userId: string) => `dabbir.demo.data.${userId}`

export function createDemoRepository(
  userId: string,
  opts: { storage?: Storage; seed?: (userId: string) => DemoState; latencyMs?: number } = {},
): DataRepository {
  const storage = opts.storage ?? window.localStorage
  const key = demoStorageKey(userId)
  const empty = (): DemoState => ({ profile: { id: userId, displayName: null, monthlyIncome: 0, savingsTarget: 0, payday: 27, ...DEFAULT_PREFERENCES }, expenses: [], limits: [], commitments: [], goals: [] })

  const load = (): DemoState => {
    const raw = storage.getItem(key)
    if (raw) {
      try {
        const s = JSON.parse(raw) as DemoState
        // بيانات محفوظة من إصدار أقدم بدون التفضيلات.
        s.profile = { ...DEFAULT_PREFERENCES, ...s.profile }
        return s
      } catch { /* بيانات تالفة → نبدأ من جديد */ }
    }
    const s = opts.seed ? opts.seed(userId) : empty()
    storage.setItem(key, JSON.stringify(s))
    return s
  }
  const save = (s: DemoState) => storage.setItem(key, JSON.stringify(s))
  const delay = () => (opts.latencyMs ? new Promise((r) => setTimeout(r, opts.latencyMs)) : Promise.resolve())
  const mutate = async <T>(fn: (s: DemoState) => T): Promise<T> => {
    await delay()
    const s = load()
    const out = fn(s)
    save(s)
    return structuredClone(out)
  }
  const read = async <T>(fn: (s: DemoState) => T): Promise<T> => {
    await delay()
    return structuredClone(fn(load()))
  }
  const notFound = () => new AppError('not_found', 'العنصر غير موجود أو تم حذفه.')
  const assertPositive = (n: number) => {
    if (!(n > 0)) throw new AppError('invalid', 'القيمة المدخلة غير مقبولة.')
  }

  return {
    getProfile: () => read((s) => s.profile),
    updateProfile: (patch) => mutate((s) => (s.profile = { ...s.profile, ...patch })),

    listExpenses: ({ from, to }) => read((s) => s.expenses
      .filter((e) => e.spentOn >= from && e.spentOn <= to)
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt))),
    addExpense: (input) => mutate((s) => {
      assertPositive(input.amount)
      const e: Expense = { ...input, amount: roundMoney(input.amount), id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      s.expenses.push(e)
      return e
    }),
    updateExpense: (id, patch) => mutate((s) => {
      const i = s.expenses.findIndex((e) => e.id === id)
      if (i < 0) throw notFound()
      if (patch.amount !== undefined) assertPositive(patch.amount)
      return (s.expenses[i] = { ...s.expenses[i]!, ...patch, id })
    }),
    deleteExpense: (id) => mutate((s) => void (s.expenses = s.expenses.filter((e) => e.id !== id))),

    listBudgetLimits: () => read((s) => s.limits),
    setBudgetLimit: (category, monthlyLimit) => mutate((s) => {
      assertPositive(monthlyLimit)
      s.limits = [...s.limits.filter((l) => l.category !== category), { category, monthlyLimit }]
    }),
    removeBudgetLimit: (category) => mutate((s) => void (s.limits = s.limits.filter((l) => l.category !== category))),

    listCommitments: () => read((s) => [...s.commitments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))),
    addCommitment: (input) => mutate((s) => {
      const c: Commitment = { ...input, id: crypto.randomUUID(), done: false }
      s.commitments.push(c)
      return c
    }),
    updateCommitment: (id, patch) => mutate((s) => {
      const i = s.commitments.findIndex((c) => c.id === id)
      if (i < 0) throw notFound()
      return (s.commitments[i] = { ...s.commitments[i]!, ...patch, id })
    }),
    deleteCommitment: (id) => mutate((s) => void (s.commitments = s.commitments.filter((c) => c.id !== id))),

    listGoals: () => read((s) => s.goals),
    addGoal: (input) => mutate((s) => {
      assertPositive(input.targetAmount)
      const g: SavingsGoal = { ...input, currentAmount: roundMoney(Math.max(0, input.currentAmount)), id: crypto.randomUUID() }
      s.goals.push(g)
      return g
    }),
    updateGoal: (id, patch) => mutate((s) => {
      const i = s.goals.findIndex((g) => g.id === id)
      if (i < 0) throw notFound()
      return (s.goals[i] = { ...s.goals[i]!, ...patch, id })
    }),
    adjustGoal: (id, delta) => mutate((s) => {
      const g = s.goals.find((x) => x.id === id)
      if (!g) throw notFound()
      if (!delta || !Number.isFinite(delta)) throw new AppError('invalid', 'القيمة المدخلة غير مقبولة.')
      g.currentAmount = roundMoney(Math.max(0, g.currentAmount + delta))
      return g
    }),
    deleteGoal: (id) => mutate((s) => void (s.goals = s.goals.filter((g) => g.id !== id))),
    clearAllData: () => mutate((s) => {
      s.expenses = []
      s.limits = []
      s.commitments = []
      s.goals = []
      s.profile = { ...s.profile, monthlyIncome: 0, savingsTarget: 0, payday: 27, ...DEFAULT_PREFERENCES }
    }),
  }
}
