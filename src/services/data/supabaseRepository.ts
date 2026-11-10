import type { SupabaseClient } from '@supabase/supabase-js'
import { dataError } from '@/services/errors'
import type { BudgetLimit, Commitment, Expense, Profile, SavingsGoal } from '@/types/domain'
import type { DataRepository } from './types'

/* ---------- تحويل الصفوف (snake_case) ↔ النطاق (camelCase) ---------- */
type Row = Record<string, unknown>
const num = (v: unknown) => Number(v ?? 0)
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export const mapProfile = (r: Row): Profile => ({
  id: String(r.id), displayName: (r.display_name as string) ?? null,
  monthlyIncome: num(r.monthly_income), savingsTarget: num(r.savings_target), payday: num(r.payday) || 27,
})
export const mapExpense = (r: Row): Expense => ({
  id: String(r.id), amount: num(r.amount), category: r.category as Expense['category'],
  note: (r.note as string) ?? null, spentOn: String(r.spent_on), createdAt: String(r.created_at),
})
export const mapCommitment = (r: Row): Commitment => ({
  id: String(r.id), title: String(r.title), kind: r.kind as Commitment['kind'], dueDate: String(r.due_date),
  dueTime: (r.due_time as string)?.slice(0, 5) ?? null, amount: numOrNull(r.amount),
  recurrence: r.recurrence as Commitment['recurrence'], done: Boolean(r.done), notes: (r.notes as string) ?? null,
})
export const mapGoal = (r: Row): SavingsGoal => ({
  id: String(r.id), name: String(r.name), targetAmount: num(r.target_amount),
  currentAmount: num(r.current_amount), targetDate: (r.target_date as string) ?? null,
})

function commitmentToRow(c: Partial<Omit<Commitment, 'id'>>): Row {
  const row: Row = {}
  if (c.title !== undefined) row.title = c.title
  if (c.kind !== undefined) row.kind = c.kind
  if (c.dueDate !== undefined) row.due_date = c.dueDate
  if (c.dueTime !== undefined) row.due_time = c.dueTime
  if (c.amount !== undefined) row.amount = c.amount
  if (c.recurrence !== undefined) row.recurrence = c.recurrence
  if (c.done !== undefined) row.done = c.done
  if (c.notes !== undefined) row.notes = c.notes
  return row
}

async function run<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  let res: { data: T; error: unknown }
  try {
    res = await p
  } catch (e) {
    throw dataError(e)
  }
  if (res.error) throw dataError(res.error)
  // delete بدون select يعيد null: نعامله كنجاح.
  return (res.data ?? []) as NonNullable<T>
}

/**
 * لا نمرر user_id من الواجهة: القاعدة تعبّئه بـ default auth.uid() وتتحقق منه سياسات RLS.
 * فلترة .eq('user_id') غير مطلوبة أمنيًا (RLS تفعلها) لكنها تُبقي الاستعلام واضحًا ويستفيد من الفهرس.
 */
export function createSupabaseRepository(sb: SupabaseClient, userId: string): DataRepository {
  return {
    async getProfile() {
      return mapProfile(await run(sb.from('profiles').select('*').eq('id', userId).single()))
    },
    async updateProfile(patch) {
      const row: Row = {}
      if (patch.displayName !== undefined) row.display_name = patch.displayName
      if (patch.monthlyIncome !== undefined) row.monthly_income = patch.monthlyIncome
      if (patch.savingsTarget !== undefined) row.savings_target = patch.savingsTarget
      if (patch.payday !== undefined) row.payday = patch.payday
      return mapProfile(await run(sb.from('profiles').update(row).eq('id', userId).select('*').single()))
    },

    async listExpenses({ from, to }) {
      const rows = await run(sb.from('expenses').select('*').eq('user_id', userId).gte('spent_on', from).lte('spent_on', to)
        .order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(1000))
      return (rows as Row[]).map(mapExpense)
    },
    async addExpense(e) {
      return mapExpense(await run(sb.from('expenses').insert({ amount: e.amount, category: e.category, note: e.note, spent_on: e.spentOn }).select('*').single()))
    },
    async deleteExpense(id) {
      await run(sb.from('expenses').delete().eq('id', id))
    },

    async listBudgetLimits() {
      const rows = await run(sb.from('budget_limits').select('category, monthly_limit').eq('user_id', userId))
      return (rows as Row[]).map((r): BudgetLimit => ({ category: r.category as BudgetLimit['category'], monthlyLimit: num(r.monthly_limit) }))
    },
    async setBudgetLimit(category, monthlyLimit) {
      await run(sb.from('budget_limits').upsert({ user_id: userId, category, monthly_limit: monthlyLimit }, { onConflict: 'user_id,category' }))
    },
    async removeBudgetLimit(category) {
      await run(sb.from('budget_limits').delete().eq('user_id', userId).eq('category', category))
    },

    async listCommitments() {
      const rows = await run(sb.from('commitments').select('*').eq('user_id', userId).order('due_date').limit(500))
      return (rows as Row[]).map(mapCommitment)
    },
    async addCommitment(c) {
      return mapCommitment(await run(sb.from('commitments').insert(commitmentToRow({ ...c, done: false })).select('*').single()))
    },
    async updateCommitment(id, patch) {
      return mapCommitment(await run(sb.from('commitments').update(commitmentToRow(patch)).eq('id', id).select('*').single()))
    },
    async deleteCommitment(id) {
      await run(sb.from('commitments').delete().eq('id', id))
    },

    async listGoals() {
      const rows = await run(sb.from('savings_goals').select('*').eq('user_id', userId).order('created_at'))
      return (rows as Row[]).map(mapGoal)
    },
    async addGoal(g) {
      return mapGoal(await run(sb.from('savings_goals').insert({ name: g.name, target_amount: g.targetAmount, current_amount: g.currentAmount, target_date: g.targetDate }).select('*').single()))
    },
    async updateGoal(id, patch) {
      const row: Row = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.targetAmount !== undefined) row.target_amount = patch.targetAmount
      if (patch.targetDate !== undefined) row.target_date = patch.targetDate
      return mapGoal(await run(sb.from('savings_goals').update(row).eq('id', id).select('*').single()))
    },
    async adjustGoal(id, delta) {
      return mapGoal(await run(sb.rpc('adjust_goal_amount', { p_goal_id: id, p_delta: delta }).single()))
    },
    async deleteGoal(id) {
      await run(sb.from('savings_goals').delete().eq('id', id))
    },
    async clearAllData() {
      // RPC ذرّية: إما يُمسح كل شيء أو لا شيء.
      await run(sb.rpc('reset_my_data'))
    },
  }
}
