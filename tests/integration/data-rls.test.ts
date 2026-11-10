/**
 * البيانات على Supabase حقيقي محلي، عبر نفس كود التطبيق (createSupabaseRepository):
 * - إنشاء/قراءة/تعديل/حذف لكل الكيانات.
 * - المزامنة بين جهازين لنفس الحساب.
 * - عزل البيانات (RLS) بين حسابين، بمحاولات وصول مباشرة عبر الـ API.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseRepository } from '@/services/data/supabaseRepository'
import type { DataRepository } from '@/services/data/types'
import { ANON, confirmedUser, device, PASSWORD, URL_ } from './helpers'

type User = Awaited<ReturnType<typeof confirmedUser>>
let A: User, B: User, repoA: DataRepository, repoB: DataRepository
const ids: Record<string, string> = {}

beforeAll(async () => {
  A = await confirmedUser('alice')
  B = await confirmedUser('bob')
  repoA = createSupabaseRepository(A.sb, A.id)
  repoB = createSupabaseRepository(B.sb, B.id)
})

describe('CRUD through the app repository (user A)', () => {
  it('profile + preferences', async () => {
    const p = await repoA.updateProfile({ displayName: 'أليس', monthlyIncome: 9000, savingsTarget: 1000, payday: 25, showHijri: false, alertDays: 7 })
    expect(p).toMatchObject({ displayName: 'أليس', monthlyIncome: 9000, savingsTarget: 1000, payday: 25, showHijri: false, alertDays: 7 })
  })
  it('expenses: add, update, list by range, delete', async () => {
    const e = await repoA.addExpense({ amount: 45.5, category: 'food', note: 'غداء', spentOn: '2026-11-05' })
    ids.expense = e.id
    const u = await repoA.updateExpense(e.id, { amount: 60, category: 'transport', note: 'بنزين' })
    expect(u).toMatchObject({ amount: 60, category: 'transport', note: 'بنزين' })
    const tmp = await repoA.addExpense({ amount: 1, category: 'other', note: null, spentOn: '2026-10-01' })
    expect((await repoA.listExpenses({ from: '2026-11-01', to: '2026-11-30' })).map((x) => x.id)).toEqual([e.id])
    await repoA.deleteExpense(tmp.id)
    expect(await repoA.listExpenses({ from: '2026-10-01', to: '2026-10-31' })).toEqual([])
  })
  it('budget limits: upsert per category and remove', async () => {
    await repoA.setBudgetLimit('food', 1500)
    await repoA.setBudgetLimit('food', 1800)
    await repoA.setBudgetLimit('bills', 600)
    expect((await repoA.listBudgetLimits()).sort((a, b) => a.category.localeCompare(b.category)))
      .toEqual([{ category: 'bills', monthlyLimit: 600 }, { category: 'food', monthlyLimit: 1800 }])
    await repoA.removeBudgetLimit('bills')
    expect(await repoA.listBudgetLimits()).toEqual([{ category: 'food', monthlyLimit: 1800 }])
  })
  it('commitments and fixed costs: add, edit, complete, delete', async () => {
    const rent = await repoA.addCommitment({ title: 'الإيجار', kind: 'bill', dueDate: '2026-11-27', dueTime: null, amount: 2500, recurrence: 'monthly', notes: null })
    ids.commitment = rent.id
    const edited = await repoA.updateCommitment(rent.id, { amount: 2600, dueTime: '09:30' })
    expect(edited).toMatchObject({ amount: 2600, dueTime: '09:30', recurrence: 'monthly' })
    const moved = await repoA.updateCommitment(rent.id, { dueDate: '2026-12-27' })
    expect(moved.dueDate).toBe('2026-12-27')
    const once = await repoA.addCommitment({ title: 'موعد', kind: 'appointment', dueDate: '2026-11-11', dueTime: null, amount: null, recurrence: 'none', notes: null })
    expect((await repoA.updateCommitment(once.id, { done: true })).done).toBe(true)
    await repoA.deleteCommitment(once.id)
    expect((await repoA.listCommitments()).map((c) => c.id)).toEqual([rent.id])
  })
  it('goals: add, edit, atomic deposit/withdraw (never below 0), delete', async () => {
    const g = await repoA.addGoal({ name: 'طوارئ', targetAmount: 10000, currentAmount: 500, targetDate: null })
    ids.goal = g.id
    expect((await repoA.updateGoal(g.id, { name: 'صندوق الطوارئ', targetAmount: 12000, targetDate: '2027-11-01' })))
      .toMatchObject({ name: 'صندوق الطوارئ', targetAmount: 12000, targetDate: '2027-11-01', currentAmount: 500 })
    expect((await repoA.adjustGoal(g.id, 1500)).currentAmount).toBe(2000)
    // 10 إيداعات متزامنة: لا تضيع أي عملية (ذرية في القاعدة)
    await Promise.all(Array.from({ length: 10 }, () => repoA.adjustGoal(g.id, 10)))
    expect((await repoA.listGoals())[0]!.currentAmount).toBe(2100)
    expect((await repoA.adjustGoal(g.id, -99999)).currentAmount).toBe(0)
    const tmp = await repoA.addGoal({ name: 'مؤقت', targetAmount: 1, currentAmount: 0, targetDate: null })
    await repoA.deleteGoal(tmp.id)
    expect((await repoA.listGoals()).map((x) => x.id)).toEqual([g.id])
  })
  it('database constraints reject invalid values', async () => {
    await expect(repoA.addExpense({ amount: -5, category: 'food', note: null, spentOn: '2026-11-01' })).rejects.toMatchObject({ code: 'invalid' })
    await expect(repoA.updateProfile({ alertDays: 99 })).rejects.toMatchObject({ code: 'invalid' })
  })
  it('lists more than 1000 expenses (pagination past the API row cap)', async () => {
    const rows = Array.from({ length: 1205 }, (_, i) => ({ amount: 1, category: 'other', spent_on: '2025-01-15', note: `bulk-${i}` }))
    for (let i = 0; i < rows.length; i += 400) expect((await A.sb.from('expenses').insert(rows.slice(i, i + 400))).error).toBeNull()
    expect((await repoA.listExpenses({ from: '2025-01-01', to: '2025-01-31' })).length).toBe(1205)
  })
})

describe('sync between two devices (same account)', () => {
  it('device 2 sees what device 1 saved, and vice versa', async () => {
    const d2 = device()
    await d2.auth.signInWithPassword({ email: A.email, password: PASSWORD })
    const repo2 = createSupabaseRepository(d2, A.id)
    const e = await repoA.addExpense({ amount: 12, category: 'food', note: 'من الجهاز 1', spentOn: '2026-11-08' })
    expect((await repo2.listExpenses({ from: '2026-11-01', to: '2026-11-30' })).some((x) => x.id === e.id)).toBe(true)
    await repo2.updateExpense(e.id, { note: 'عُدّل من الجهاز 2' })
    expect((await repoA.listExpenses({ from: '2026-11-08', to: '2026-11-08' })).find((x) => x.id === e.id)?.note).toBe('عُدّل من الجهاز 2')
    expect((await repo2.getProfile()).displayName).toBe('أليس')
  })
})

describe('RLS: user B cannot reach user A data', () => {
  it('B sees only own (empty) data through the app', async () => {
    expect(await repoB.listExpenses({ from: '2000-01-01', to: '2100-01-01' })).toEqual([])
    expect(await repoB.listCommitments()).toEqual([])
    expect(await repoB.listGoals()).toEqual([])
    expect(await repoB.listBudgetLimits()).toEqual([])
    expect((await repoB.getProfile()).id).toBe(B.id)
  })
  it('direct API reads of A rows by id return nothing', async () => {
    for (const [table, id] of [['expenses', ids.expense], ['commitments', ids.commitment], ['savings_goals', ids.goal]] as const) {
      const r = await B.sb.from(table).select('*').eq('id', id!)
      expect(r.error).toBeNull()
      expect(r.data).toEqual([])
    }
    expect((await B.sb.from('profiles').select('*').eq('id', A.id)).data).toEqual([])
  })
  it('direct API update/delete of A rows affect 0 rows', async () => {
    const u = await B.sb.from('expenses').update({ amount: 1 }).eq('id', ids.expense!).select()
    expect(u.data).toEqual([])
    const d = await B.sb.from('savings_goals').delete().eq('id', ids.goal!).select()
    expect(d.data).toEqual([])
    const p = await B.sb.from('profiles').update({ monthly_income: 1 }).eq('id', A.id).select()
    expect(p.data).toEqual([])
    expect((await repoA.getProfile()).monthlyIncome).toBe(9000)
    expect((await repoA.listGoals()).length).toBe(1)
  })
  it('B cannot insert rows owned by A, nor move own rows to A', async () => {
    const ins = await B.sb.from('expenses').insert({ user_id: A.id, amount: 5, category: 'food' })
    expect(ins.error?.code).toBe('42501')
    const own = await repoB.addExpense({ amount: 3, category: 'food', note: null, spentOn: '2026-11-01' })
    const move = await B.sb.from('expenses').update({ user_id: A.id }).eq('id', own.id)
    expect(move.error?.code).toBe('42501')
  })
  it('B cannot deposit into A goal via RPC, and reset_my_data only touches B', async () => {
    await expect(repoB.adjustGoal(ids.goal!, 100)).rejects.toMatchObject({ code: 'not_found' })
    await repoB.clearAllData()
    expect((await repoA.listGoals()).length).toBe(1)
    expect((await repoA.listCommitments()).length).toBe(1)
  })
  it('anonymous (anon key, no login) gets no data', async () => {
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
    for (const t of ['profiles', 'expenses', 'budget_limits', 'commitments', 'savings_goals', 'legacy_v2_imports']) {
      const r = await anon.from(t).select('*')
      expect(r.data ?? []).toEqual([])
      expect(r.error).not.toBeNull()
    }
    expect((await anon.rpc('reset_my_data')).error).not.toBeNull()
  })
  it('a forged JWT (wrong secret) is rejected', async () => {
    const head = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')
    const body = Buffer.from(JSON.stringify({ sub: A.id, role: 'authenticated', aud: 'authenticated', exp: 4900000000 })).toString('base64url')
    const forged = `${head}.${body}.${Buffer.from('not-the-secret').toString('base64url')}`
    const res = await fetch(`${URL_}/rest/v1/expenses?select=*`, { headers: { apikey: ANON, Authorization: `Bearer ${forged}` } })
    expect(res.status).toBe(401)
  })
  it('requests without the API key are refused by the gateway', async () => {
    expect((await fetch(`${URL_}/rest/v1/expenses?select=*`)).status).toBe(401)
  })
})

describe('clearAllData (real account)', () => {
  it('wipes A data and resets preferences, account remains', async () => {
    await repoA.clearAllData()
    expect(await repoA.listGoals()).toEqual([])
    expect(await repoA.listCommitments()).toEqual([])
    expect(await repoA.listBudgetLimits()).toEqual([])
    expect(await repoA.listExpenses({ from: '2000-01-01', to: '2100-01-01' })).toEqual([])
    expect(await repoA.getProfile()).toMatchObject({ displayName: 'أليس', monthlyIncome: 0, showHijri: true, alertDays: 3 })
  })
})
