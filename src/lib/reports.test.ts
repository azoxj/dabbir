import { describe, expect, it } from 'vitest'
import type { Expense } from '@/types/domain'
import { categoryTotals, compareWithPreviousMonth, monthlyTotals, reportRange, savingsSummary } from './reports'

const e = (amount: number, spentOn: string, category: Expense['category'] = 'food'): Expense => ({ id: crypto.randomUUID(), amount, category, note: null, spentOn, createdAt: '' })

describe('reports', () => {
  const list = [e(100, '2026-06-30'), e(200, '2026-07-01'), e(50, '2026-10-05', 'transport'), e(300, '2026-11-01'), e(100, '2026-11-09', 'bills'), e(999, '2026-05-31')]
  it('monthly totals for the last 6 months, oldest first, across year/month ends', () => {
    const t = monthlyTotals(list, '2026-11-10')
    expect(t.map((x) => x.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(t.map((x) => x.total)).toEqual([100, 200, 0, 0, 50, 400])
    expect(reportRange('2026-11-10')).toEqual({ from: '2026-06-01', to: '2026-11-30' })
    expect(monthlyTotals([e(1, '2026-01-15')], '2026-02-10', 3).map((x) => x.month)).toEqual(['2025-12', '2026-01', '2026-02'])
  })
  it('category totals with shares, sorted', () => {
    const c = categoryTotals(list, '2026-11-01', '2026-11-30')
    expect(c).toEqual([{ category: 'food', total: 300, share: 0.75 }, { category: 'bills', total: 100, share: 0.25 }])
  })
  it('month comparison and daily average', () => {
    const cmp = compareWithPreviousMonth(monthlyTotals(list, '2026-11-10'), '2026-11-10')
    expect(cmp).toMatchObject({ current: 400, previous: 50, change: 7, dailyAverage: 40 })
    expect(compareWithPreviousMonth(monthlyTotals([], '2026-11-10'), '2026-11-10').change).toBeNull()
  })
  it('savings summary', () => {
    expect(savingsSummary([
      { id: 'a', name: 'a', targetAmount: 1000, currentAmount: 1000, targetDate: null },
      { id: 'b', name: 'b', targetAmount: 3000, currentAmount: 500, targetDate: null },
    ])).toEqual({ saved: 1500, target: 4000, ratio: 0.375, completed: 1 })
  })
})
