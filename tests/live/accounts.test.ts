/**
 * اختبار حي على Supabase الحقيقي (dabbir-production) بحسابين مؤقتين مؤكَّدين مسبقًا:
 * الدخول، الجلسات، CRUD عبر كود التطبيق، المزامنة بين جهازين، عزل الحسابين عبر الـ API، الخروج.
 * لا بيانات حقيقية: الحسابان @example.test ويُحذفان بعد الاختبار.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseRepository } from '@/services/data/supabaseRepository'

const env = Object.fromEntries(readFileSync(fileURLToPath(new URL('../../.env.production', import.meta.url)), 'utf8')
  .split('\n').filter((l) => l.startsWith('VITE_')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
// LIVE_URL/LIVE_KEY: لتجربة نفس الاختبار على Supabase المحلي قبل تشغيله على الإنتاج.
const URL_ = process.env.LIVE_URL || env.VITE_SUPABASE_URL!
const KEY = process.env.LIVE_KEY || env.VITE_SUPABASE_ANON_KEY!
const U = {
  a: { email: process.env.LIVE_A_EMAIL!, id: process.env.LIVE_A_ID!, password: process.env.LIVE_A_PASSWORD! },
  b: { email: process.env.LIVE_B_EMAIL!, id: process.env.LIVE_B_ID!, password: process.env.LIVE_B_PASSWORD! },
}

function device(): SupabaseClient {
  const store = new Map<string, string>()
  return createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) } } })
}

let A: SupabaseClient, A2: SupabaseClient, B: SupabaseClient

beforeAll(async () => {
  // ننتظر حتى يُنشأ الحسابان في القاعدة (خطوة خارجية عبر Management API) — حتى 12 دقيقة.
  for (let i = 0; i < 72; i++) {
    const c = device()
    const { error } = await c.auth.signInWithPassword({ email: U.a.email, password: U.a.password })
    if (!error) break
    if (i === 71) throw new Error(`test accounts were not provisioned: ${error.message}`)
    await new Promise((r) => setTimeout(r, 10_000))
  }
  A = device(); A2 = device(); B = device()
  for (const [c, u] of [[A, U.a], [A2, U.a], [B, U.b]] as const) {
    const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.password })
    expect(error).toBeNull()
  }
})

afterAll(async () => {
  // تنظيف بيانات الحسابين (الحسابان نفسهما يُحذفان بعدها من القاعدة).
  for (const [c, u] of [[A, U.a], [B, U.b]] as const) if (c) await createSupabaseRepository(c, u.id).clearAllData().catch(() => {})
})

describe('live: sessions', () => {
  it('signed in as the right users; profile auto-created by the trigger', async () => {
    expect((await A.auth.getUser()).data.user?.id).toBe(U.a.id)
    expect((await createSupabaseRepository(A, U.a.id).getProfile()).id).toBe(U.a.id)
  })
  it('wrong password is refused with invalid_credentials', async () => {
    expect((await device().auth.signInWithPassword({ email: U.a.email, password: 'wrong-pass-123' })).error?.code).toBe('invalid_credentials')
  })
  it('session refresh issues a new access token', async () => {
    const before = (await A.auth.getSession()).data.session!.access_token
    await new Promise((r) => setTimeout(r, 1100))
    const { data, error } = await A.auth.refreshSession()
    expect(error).toBeNull()
    expect(data.session!.access_token).not.toBe(before)
  })
})

describe('live: data through the app repository', () => {
  it('profile, expenses, limits, fixed costs, commitments, goals — create/edit/delete', async () => {
    const r = createSupabaseRepository(A, U.a.id)
    expect(await r.updateProfile({ displayName: 'حي', monthlyIncome: 8000, savingsTarget: 800, alertDays: 5, showHijri: false }))
      .toMatchObject({ displayName: 'حي', monthlyIncome: 8000, alertDays: 5, showHijri: false })
    const e = await r.addExpense({ amount: 42.5, category: 'food', note: 'live', spentOn: '2026-11-10' })
    expect((await r.updateExpense(e.id, { amount: 50 })).amount).toBe(50)
    await r.setBudgetLimit('food', 1200)
    expect(await r.listBudgetLimits()).toEqual([{ category: 'food', monthlyLimit: 1200 }])
    const rent = await r.addCommitment({ title: 'الإيجار', kind: 'bill', dueDate: '2026-11-27', dueTime: null, amount: 2000, recurrence: 'monthly', notes: null })
    expect((await r.updateCommitment(rent.id, { amount: 2100 })).amount).toBe(2100)
    const g = await r.addGoal({ name: 'طوارئ', targetAmount: 5000, currentAmount: 0, targetDate: null })
    await Promise.all(Array.from({ length: 5 }, () => r.adjustGoal(g.id, 10)))
    expect((await r.listGoals())[0]!.currentAmount).toBe(50)
    const tmp = await r.addExpense({ amount: 1, category: 'other', note: null, spentOn: '2026-11-01' })
    await r.deleteExpense(tmp.id)
    expect((await r.listExpenses({ from: '2026-11-01', to: '2026-11-30' })).map((x) => x.id)).toEqual([e.id])
    await expect(r.addExpense({ amount: -1, category: 'food', note: null, spentOn: '2026-11-01' })).rejects.toMatchObject({ code: 'invalid' })
  })
  it('sync: a second device of the same user sees and edits the same data', async () => {
    const r1 = createSupabaseRepository(A, U.a.id)
    const r2 = createSupabaseRepository(A2, U.a.id)
    const e = await r1.addExpense({ amount: 7, category: 'transport', note: 'جهاز 1', spentOn: '2026-11-09' })
    expect((await r2.listExpenses({ from: '2026-11-09', to: '2026-11-09' })).some((x) => x.id === e.id)).toBe(true)
    await r2.updateExpense(e.id, { note: 'عُدّل من جهاز 2' })
    expect((await r1.listExpenses({ from: '2026-11-09', to: '2026-11-09' })).find((x) => x.id === e.id)?.note).toBe('عُدّل من جهاز 2')
  })
})

describe('live: isolation between two real accounts (RLS via the API)', () => {
  it('B sees none of A data and cannot change it', async () => {
    const rb = createSupabaseRepository(B, U.b.id)
    expect(await rb.listExpenses({ from: '2000-01-01', to: '2100-01-01' })).toEqual([])
    const aExpense = (await createSupabaseRepository(A, U.a.id).listExpenses({ from: '2026-11-01', to: '2026-11-30' }))[0]!
    expect((await B.from('expenses').select('*').eq('id', aExpense.id)).data).toEqual([])
    expect((await B.from('expenses').update({ amount: 1 }).eq('id', aExpense.id).select()).data).toEqual([])
    expect((await B.from('expenses').delete().eq('id', aExpense.id).select()).data).toEqual([])
    expect((await B.from('profiles').select('*').eq('id', U.a.id)).data).toEqual([])
    expect((await B.from('expenses').insert({ user_id: U.a.id, amount: 1, category: 'food' })).error?.code).toBe('42501')
    const goal = (await createSupabaseRepository(A, U.a.id).listGoals())[0]!
    await expect(rb.adjustGoal(goal.id, 100)).rejects.toMatchObject({ code: 'not_found' })
    expect((await createSupabaseRepository(A, U.a.id).listGoals())[0]!.currentAmount).toBe(50)
  })
})

describe('live: sign out', () => {
  it('sign out on all devices revokes the other device refresh token', async () => {
    const extra = device()
    await extra.auth.signInWithPassword({ email: U.b.email, password: U.b.password })
    const otherRefresh = (await extra.auth.getSession()).data.session!.refresh_token
    const signer = device()
    await signer.auth.signInWithPassword({ email: U.b.email, password: U.b.password })
    await signer.auth.signOut({ scope: 'global' })
    expect((await device().auth.refreshSession({ refresh_token: otherRefresh })).error).not.toBeNull()
    // B يسجّل دخول من جديد للتنظيف في afterAll
    await B.auth.signInWithPassword({ email: U.b.email, password: U.b.password })
  })
})
