import { describe, expect, it } from 'vitest'
import { dueReminders } from './reminders'
import type { Commitment, SavingsGoal } from '@/types/domain'

const commitment = { id: 'c1', title: 'إيجار', kind: 'bill', dueDate: '2026-11-14', dueTime: null, amount: 1500, recurrence: 'monthly', done: false, notes: null } satisfies Commitment
const goal = { id: 'g1', name: 'طوارئ', currentAmount: 200, targetAmount: 1000, targetDate: '2026-11-13' } satisfies SavingsGoal
describe('due reminders', () => {
  it('shows upcoming commitments and savings targets', () => {
    expect(dueReminders('2026-11-12', [commitment], [goal], 3).map(x => x.id)).toEqual(['goal:g1:2026-11-13', 'commitment:c1:2026-11-14'])
  })
  it('does not notify completed commitments or achieved goals', () => {
    expect(dueReminders('2026-11-12', [{ ...commitment, done: true }], [{ ...goal, currentAmount: 1000 }], 3)).toEqual([])
  })
  it('does not notify early, but includes overdue items', () => {
    expect(dueReminders('2026-11-10', [commitment], [goal], 1)).toEqual([])
    expect(dueReminders('2026-11-16', [commitment], [goal], 1)).toHaveLength(2)
  })
})
