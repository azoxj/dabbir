import { describe, expect, it } from 'vitest'
import { createDemoRepository } from './demoRepository'
import { buildDemoSeed } from './demoSeed'

describe('demoRepository', () => {
  it('isolates data per user', async () => {
    const a = createDemoRepository('user-a')
    const b = createDemoRepository('user-b')
    await a.addExpense({ amount: 50, category: 'food', note: 'A', spentOn: '2026-11-10' })
    await a.addGoal({ name: 'A goal', targetAmount: 100, currentAmount: 0, targetDate: null })
    expect(await b.listExpenses({ from: '2026-11-01', to: '2026-11-30' })).toHaveLength(0)
    expect(await b.listGoals()).toHaveLength(0)
    expect(await a.listExpenses({ from: '2026-11-01', to: '2026-11-30' })).toHaveLength(1)
  })

  it('filters expenses by range and sorts newest first', async () => {
    const r = createDemoRepository('u')
    await r.addExpense({ amount: 1, category: 'food', note: 'old', spentOn: '2026-10-31' })
    await r.addExpense({ amount: 2, category: 'food', note: 'n1', spentOn: '2026-11-02' })
    await r.addExpense({ amount: 3, category: 'food', note: 'n2', spentOn: '2026-11-05' })
    expect((await r.listExpenses({ from: '2026-11-01', to: '2026-11-30' })).map((e) => e.note)).toEqual(['n2', 'n1'])
  })

  it('rejects non-positive amounts and keeps goal balance >= 0', async () => {
    const r = createDemoRepository('u')
    await expect(r.addExpense({ amount: 0, category: 'food', note: null, spentOn: '2026-11-01' })).rejects.toMatchObject({ code: 'invalid' })
    const g = await r.addGoal({ name: 'g', targetAmount: 1000, currentAmount: 100, targetDate: null })
    expect((await r.adjustGoal(g.id, 50.5)).currentAmount).toBe(150.5)
    expect((await r.adjustGoal(g.id, -999)).currentAmount).toBe(0)
  })

  it('upserts budget limits per category', async () => {
    const r = createDemoRepository('u')
    await r.setBudgetLimit('food', 500)
    await r.setBudgetLimit('food', 800)
    expect(await r.listBudgetLimits()).toEqual([{ category: 'food', monthlyLimit: 800 }])
    await r.removeBudgetLimit('food')
    expect(await r.listBudgetLimits()).toEqual([])
  })

  it('updates commitments and returns not_found for missing ids', async () => {
    const r = createDemoRepository('u')
    const c = await r.addCommitment({ title: 't', kind: 'bill', dueDate: '2026-11-10', dueTime: null, amount: null, recurrence: 'none', notes: null })
    expect((await r.updateCommitment(c.id, { done: true })).done).toBe(true)
    await expect(r.updateCommitment('missing', { done: true })).rejects.toMatchObject({ code: 'not_found' })
  })

  it('clearAllData wipes only this user and keeps the name', async () => {
    const a = createDemoRepository('a', { seed: buildDemoSeed })
    const b = createDemoRepository('b', { seed: buildDemoSeed })
    await b.getProfile()
    await a.clearAllData()
    expect(await a.listGoals()).toEqual([])
    expect(await a.listCommitments()).toEqual([])
    expect(await a.listBudgetLimits()).toEqual([])
    expect((await a.getProfile())).toMatchObject({ monthlyIncome: 0, displayName: 'ضيف دبّر' })
    expect((await b.listGoals()).length).toBeGreaterThan(0)
  })

  it('seeds the guest account', async () => {
    const r = createDemoRepository('guest', { seed: buildDemoSeed })
    expect((await r.getProfile()).monthlyIncome).toBeGreaterThan(0)
    expect((await r.listCommitments()).length).toBeGreaterThan(0)
  })
})
