import { describe, expect, it } from 'vitest'
import { mapCommitment, mapExpense, mapGoal, mapProfile } from './supabaseRepository'

describe('supabase row mapping', () => {
  it('maps numeric strings and nullables', () => {
    expect(mapProfile({ id: 'u', display_name: null, monthly_income: '9000.50', savings_target: 0, payday: 27 }))
      .toEqual({ id: 'u', displayName: null, monthlyIncome: 9000.5, savingsTarget: 0, payday: 27 })
    expect(mapExpense({ id: 'e', amount: '12.30', category: 'food', note: null, spent_on: '2026-11-10', created_at: 't' }).amount).toBe(12.3)
    expect(mapCommitment({ id: 'c', title: 't', kind: 'bill', due_date: '2026-11-10', due_time: '17:30:00', amount: null, recurrence: 'none', done: false, notes: null }))
      .toMatchObject({ dueTime: '17:30', amount: null })
    expect(mapGoal({ id: 'g', name: 'n', target_amount: '100', current_amount: '5', target_date: null })).toMatchObject({ targetAmount: 100, currentAmount: 5 })
  })
})
