import { describe, expect, it } from 'vitest'
import type { Commitment, Expense, Profile, SavingsGoal } from '@/types/domain'
import { buildTodayPlan, effectivePayday, MAX_PLAN_ITEMS } from './todayPlan'

const profile = (p: Partial<Profile> = {}): Profile => ({ id: 'u', displayName: null, monthlyIncome: 10000, savingsTarget: 1000, payday: 27, showHijri: true, alertDays: 3, ...p })
const exp = (amount: number, spentOn: string, category: Expense['category'] = 'food'): Expense => ({ id: crypto.randomUUID(), amount, category, note: null, spentOn, createdAt: '' })
const com = (p: Partial<Commitment>): Commitment => ({ id: crypto.randomUUID(), title: 'التزام', kind: 'bill', dueDate: '2026-11-10', dueTime: null, amount: null, recurrence: 'none', done: false, notes: null, ...p })
const today = '2026-11-10'
const base = { limits: [], commitments: [] as Commitment[], goals: [] as SavingsGoal[], today }

describe('buildTodayPlan', () => {
  it('all good when nothing urgent (but logged today)', () => {
    const { items } = buildTodayPlan({ ...base, profile: profile(), expenses: [exp(20, today)] })
    expect(items[0]?.id).toBe('all-good')
    expect(items[0]?.severity).toBe('success')
  })

  it('orders overdue (critical) before today (warning) before soon (info)', () => {
    const { items } = buildTodayPlan({ ...base, profile: profile(), expenses: [exp(20, today)], commitments: [
      com({ title: 'قريب', dueDate: '2026-11-12' }),
      com({ title: 'اليوم', dueDate: today, dueTime: '17:30:00' }),
      com({ title: 'متأخر', dueDate: '2026-11-08', amount: 230 }),
      com({ title: 'بعيد', dueDate: '2026-12-30' }),
      com({ title: 'منجز', dueDate: '2026-11-01', done: true }),
    ] })
    expect(items.map((i) => i.title)).toEqual(['متأخر: متأخر', 'اليوم: اليوم', 'قريب: قريب'])
    expect(items[0]?.detail).toContain('متأخر يومين')
    expect(items[1]?.detail).toContain('17:30')
  })

  it('reminds to log expenses and to enter income', () => {
    const { items } = buildTodayPlan({ ...base, profile: profile({ monthlyIncome: 0, savingsTarget: 0 }), expenses: [] })
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining(['b-income', 'log-today']))
  })

  it('flags deficit and over-limit categories', () => {
    const { items } = buildTodayPlan({ ...base, profile: profile({ monthlyIncome: 1000 }),
      limits: [{ category: 'food', monthlyLimit: 500 }], expenses: [exp(1200, '2026-11-02')] })
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining(['b-deficit', 'l-food']))
    expect(items.every((i) => i.id !== 'all-good')).toBe(true)
  })

  it('payday reminder respects short months', () => {
    expect(effectivePayday(31, '2026-11-05')).toBe(30)
    const { items } = buildTodayPlan({ ...base, today: '2026-11-30', profile: profile({ payday: 31 }), expenses: [exp(1, '2026-11-30')] })
    expect(items.some((i) => i.id === 'payday')).toBe(true)
  })

  it('warns about goals needing more than the monthly savings target', () => {
    const goal: SavingsGoal = { id: 'g1', name: 'سيارة', targetAmount: 30000, currentAmount: 0, targetDate: '2027-05-10' }
    const { items } = buildTodayPlan({ ...base, goals: [goal], profile: profile(), expenses: [exp(1, today)] })
    expect(items.find((i) => i.id === 'g-g1')?.title).toContain('سيارة')
  })

  it('old v2 rules: ≥85% warning and commitments exceeding what is left', () => {
    const high = buildTodayPlan({ ...base, profile: profile({ monthlyIncome: 6000, savingsTarget: 0 }), expenses: [exp(1800, today)],
      commitments: [com({ dueDate: '2026-11-27', amount: 3500, recurrence: 'monthly' })] })
    expect(high.items.find((i) => i.id === 'b-high')?.title).toContain('88%')
    const over = buildTodayPlan({ ...base, profile: profile({ monthlyIncome: 3000, savingsTarget: 0 }), expenses: [exp(1000, today)],
      commitments: [com({ dueDate: '2026-11-27', amount: 2500 })] })
    expect(over.items.some((i) => i.id === 'b-commitments' && i.severity === 'critical')).toBe(true)
  })

  it('alert window follows the user preference (alertDays)', () => {
    const c5 = com({ title: 'بعد 5', dueDate: '2026-11-15' })
    const narrow = buildTodayPlan({ ...base, profile: profile({ alertDays: 3 }), expenses: [exp(1, today)], commitments: [c5] })
    expect(narrow.items.some((i) => i.title === 'قريب: بعد 5')).toBe(false)
    const wide = buildTodayPlan({ ...base, profile: profile({ alertDays: 7 }), expenses: [exp(1, today)], commitments: [c5] })
    expect(wide.items.some((i) => i.title === 'قريب: بعد 5')).toBe(true)
  })

  it('caps the number of items', () => {
    const many = Array.from({ length: 12 }, (_, i) => com({ title: `#${i}`, dueDate: '2026-11-01' }))
    expect(buildTodayPlan({ ...base, commitments: many, profile: profile(), expenses: [] }).items).toHaveLength(MAX_PLAN_ITEMS)
  })
})
