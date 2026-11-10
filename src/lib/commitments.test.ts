import { describe, expect, it } from 'vitest'
import type { Commitment } from '@/types/domain'
import { amountDueUntil, completionPatch, dueStatus, sortCommitments } from './commitments'

const c = (p: Partial<Commitment>): Commitment => ({ id: crypto.randomUUID(), title: 'x', kind: 'bill', dueDate: '2026-11-10', dueTime: null, amount: null, recurrence: 'none', done: false, notes: null, ...p })

describe('commitments', () => {
  it('classifies due status', () => {
    const t = '2026-11-10'
    expect(dueStatus(c({ dueDate: '2026-11-09' }), t)).toBe('overdue')
    expect(dueStatus(c({ dueDate: t }), t)).toBe('today')
    expect(dueStatus(c({ dueDate: '2026-11-13' }), t)).toBe('soon')
    expect(dueStatus(c({ dueDate: '2026-11-20' }), t)).toBe('upcoming')
    expect(dueStatus(c({ dueDate: '2026-12-30' }), t)).toBe('later')
    expect(dueStatus(c({ dueDate: '2026-11-01', done: true }), t)).toBe('done')
  })
  it('completion: one-off is done, recurring advances from its own due date', () => {
    expect(completionPatch(c({}))).toEqual({ done: true })
    expect(completionPatch(c({ recurrence: 'monthly', dueDate: '2026-01-31' }))).toEqual({ dueDate: '2026-02-28' })
    expect(completionPatch(c({ recurrence: 'yearly', dueDate: '2026-11-10' }))).toEqual({ dueDate: '2027-11-10' })
  })
  it('sorts open first, then by date and time', () => {
    const list = [c({ title: 'd', done: true, dueDate: '2026-01-01' }), c({ title: 'b', dueDate: '2026-11-12' }), c({ title: 'a2', dueDate: '2026-11-11', dueTime: '18:00' }), c({ title: 'a1', dueDate: '2026-11-11', dueTime: '09:00' })]
    expect(sortCommitments(list).map((x) => x.title)).toEqual(['a1', 'a2', 'b', 'd'])
  })
  it('sums amounts due including overdue, excluding done', () => {
    const list = [c({ amount: 100, dueDate: '2026-11-01' }), c({ amount: 50, dueDate: '2026-11-20' }), c({ amount: 999, dueDate: '2026-11-05', done: true }), c({ amount: 70, dueDate: '2027-01-01' })]
    expect(amountDueUntil(list, '2026-12-10')).toBe(150)
  })
})
