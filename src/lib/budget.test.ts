import { describe, expect, it } from 'vitest'
import type { Expense } from '@/types/domain'
import { limitStatus, summarizeMonth } from './budget'

const exp = (amount: number, category: Expense['category'], spentOn: string): Expense =>
  ({ id: crypto.randomUUID(), amount, category, note: null, spentOn, createdAt: '' })

describe('summarizeMonth', () => {
  it('only counts current month expenses', () => {
    const s = summarizeMonth({
      income: 10000, savingsTarget: 1000, today: '2026-11-15', limits: [],
      expenses: [exp(500, 'food', '2026-11-01'), exp(300, 'food', '2026-10-31'), exp(200, 'transport', '2026-11-15')],
    })
    expect(s.spent).toBe(700)
    expect(s.remaining).toBe(9300)
    expect(s.availableAfterSavings).toBe(8300)
    expect(s.daysLeft).toBe(16)
    expect(s.dailyAllowance).toBeCloseTo(518.75)
    expect(s.categories.map((c) => c.category)).toEqual(['food', 'transport'])
  })
  it('flags fast pace', () => {
    // 9000 قابل للصرف، 10% من الشهر مضى، صرف 5000 (55%) → سريع
    const s = summarizeMonth({ income: 10000, savingsTarget: 1000, today: '2026-11-03', limits: [], expenses: [exp(5000, 'shopping', '2026-11-02')] })
    expect(s.pace).toBe('fast')
  })
  it('handles zero income and deficit', () => {
    expect(summarizeMonth({ income: 0, savingsTarget: 0, today: '2026-11-03', limits: [], expenses: [] }).pace).toBe('no_income')
    const s = summarizeMonth({ income: 1000, savingsTarget: 0, today: '2026-11-20', limits: [], expenses: [exp(1500, 'bills', '2026-11-02')] })
    expect(s.remaining).toBe(-500)
    expect(s.dailyAllowance).toBe(0)
  })
  it('includes limits without spending and computes status', () => {
    const s = summarizeMonth({ income: 5000, savingsTarget: 0, today: '2026-11-20', expenses: [exp(450, 'food', '2026-11-02')],
      limits: [{ category: 'food', monthlyLimit: 500 }, { category: 'health', monthlyLimit: 300 }] })
    expect(s.categories.find((c) => c.category === 'food')?.status).toBe('near')
    expect(s.categories.find((c) => c.category === 'health')?.status).toBe('ok')
  })
  it('deducts unpaid commitments due this month (old rent/car logic)', () => {
    const c = (amount: number, dueDate: string, done = false) => ({ id: crypto.randomUUID(), title: 't', kind: 'bill' as const, dueDate, dueTime: null, amount, recurrence: 'monthly' as const, done, notes: null })
    // نفس مثال النسخة القديمة: راتب 6000، إيجار 2000، قسط 1500، أخرى 1800، ادخار 500
    const s = summarizeMonth({ income: 6000, savingsTarget: 500, today: '2026-11-10', limits: [],
      expenses: [exp(1800, 'other', '2026-11-05')],
      commitments: [c(2000, '2026-11-27'), c(1500, '2026-11-03'), c(999, '2026-12-01'), c(50, '2026-11-01', true)] })
    expect(s.pendingCommitments).toBe(3500)
    expect(s.availableAfterCommitments).toBe(700) // = remaining() القديمة
    expect(s.availableAfterSavings).toBe(200)     // = after القديمة
    expect(Math.round(s.committedRatio * 100)).toBe(88) // = pct القديمة (≥85%)
  })
  it('limitStatus thresholds', () => {
    expect(limitStatus(100, null)).toBe('none')
    expect(limitStatus(79, 100)).toBe('ok')
    expect(limitStatus(80, 100)).toBe('near')
    expect(limitStatus(101, 100)).toBe('over')
  })
})
