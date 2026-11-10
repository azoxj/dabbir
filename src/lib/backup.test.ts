import { describe, expect, it } from 'vitest'
import { createDemoRepository } from '@/services/data/demoRepository'
import { buildDemoSeed } from '@/services/data/demoSeed'
import { BackupError, exportBackup, importBackup, parseBackup } from './backup'

describe('backup export/import', () => {
  it('round-trips the guest data into an empty account (another origin)', async () => {
    const source = createDemoRepository('old-origin-user', { seed: buildDemoSeed })
    const file = JSON.stringify(await exportBackup(source))
    const target = createDemoRepository('new-origin-user')
    const r = await importBackup(target, parseBackup(file))
    expect(r).toMatchObject({ expenses: 5, commitments: 4, goals: 2, limits: 3 })
    const strip = (xs: { id: string }[]) => xs.map((x) => { const { id, ...rest } = x as Record<string, unknown>; void id; return rest })
    expect(strip(await target.listGoals())).toEqual(strip(await source.listGoals()))
    expect((await target.listExpenses({ from: '1900-01-01', to: '2999-12-31' })).length).toBe(5)
    expect((await target.getProfile()).monthlyIncome).toBe(9500)
  })
  it('import adds, never deletes, and keeps an existing profile income', async () => {
    const target = createDemoRepository('t')
    await target.updateProfile({ monthlyIncome: 4000 })
    await target.addExpense({ amount: 1, category: 'food', note: 'existing', spentOn: '2026-11-01' })
    await importBackup(target, parseBackup(JSON.stringify(await exportBackup(createDemoRepository('s', { seed: buildDemoSeed })))))
    expect((await target.getProfile()).monthlyIncome).toBe(4000)
    expect((await target.listExpenses({ from: '1900-01-01', to: '2999-12-31' })).some((e) => e.note === 'existing')).toBe(true)
  })
  it('rejects invalid or malicious files before writing anything', () => {
    const bad = [
      'not json', '{}', JSON.stringify({ format: 'other' }),
      JSON.stringify({ format: 'dabbir-backup', version: 99, expenses: [], limits: [], commitments: [], goals: [] }),
      JSON.stringify({ format: 'dabbir-backup', version: 1, expenses: [{ amount: -5, category: 'food', spentOn: '2026-01-01' }], limits: [], commitments: [], goals: [] }),
      JSON.stringify({ format: 'dabbir-backup', version: 1, expenses: [{ amount: 5, category: 'crypto', spentOn: '2026-01-01' }], limits: [], commitments: [], goals: [] }),
      JSON.stringify({ format: 'dabbir-backup', version: 1, expenses: [{ amount: 5, category: 'food', spentOn: '2026-02-30' }], limits: [], commitments: [], goals: [] }),
      JSON.stringify({ format: 'dabbir-backup', version: 1, expenses: 'x', limits: [], commitments: [], goals: [] }),
    ]
    for (const raw of bad) expect(() => parseBackup(raw)).toThrow(BackupError)
  })
  it('truncates over-long text and ignores unknown fields', () => {
    const b = parseBackup(JSON.stringify({ format: 'dabbir-backup', version: 1, profile: { displayName: 'x'.repeat(500), evil: true },
      expenses: [{ amount: 5, category: 'food', note: 'n'.repeat(999), spentOn: '2026-01-01', user_id: 'someone-else' }], limits: [], commitments: [], goals: [] }))
    expect(b.profile.displayName!.length).toBe(80)
    expect(b.expenses[0]!.note!.length).toBe(200)
    expect(Object.keys(b.expenses[0]!)).toEqual(['amount', 'category', 'note', 'spentOn'])
  })
})
