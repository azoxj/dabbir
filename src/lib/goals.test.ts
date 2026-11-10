import { describe, expect, it } from 'vitest'
import { goalProgress } from './goals'

const g = (current: number, target: number, targetDate: string | null) => ({ id: '1', name: 'g', currentAmount: current, targetAmount: target, targetDate })

describe('goalProgress', () => {
  it('done when target reached', () => expect(goalProgress(g(1000, 1000, null), '2026-11-10').status).toBe('done'))
  it('no date', () => {
    const p = goalProgress(g(250, 1000, null), '2026-11-10')
    expect(p).toMatchObject({ status: 'no_date', remaining: 750, ratio: 0.25, monthlyNeeded: null })
  })
  it('monthly needed for a dated goal (~12 months)', () => {
    const p = goalProgress(g(0, 12000, '2027-11-10'), '2026-11-10')
    expect(p.status).toBe('on_track')
    expect(p.monthlyNeeded).toBeGreaterThanOrEqual(1000)
    expect(p.monthlyNeeded).toBeLessThanOrEqual(1001)
  })
  it('near deadline uses at least one month', () => {
    expect(goalProgress(g(0, 3000, '2026-11-15'), '2026-11-10').monthlyNeeded).toBe(3000)
  })
  it('past due', () => expect(goalProgress(g(100, 1000, '2026-10-01'), '2026-11-10').status).toBe('past_due'))
})
