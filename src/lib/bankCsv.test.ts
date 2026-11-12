import { describe, expect, it } from 'vitest'
import { previewBankCsv } from './bankCsv'
describe('bank CSV preview', () => {
  it('parses Arabic digits and quoted merchants without uploading data', () => {
    const result = previewBankCsv('التاريخ,التاجر,المبلغ\n٢٠٢٦-١١-١٢,"متجر, الرياض",١٢٫٥٠')
    expect(result.transactions).toMatchObject([{ date: '2026-11-12', merchant: 'متجر, الرياض', amount: 12.5 }])
  })
  it('rejects malformed values and flags repeated transactions', () => {
    const result = previewBankCsv('date,description,amount\n2026-11-12,Cafe,10\n2026-11-12,Cafe,10\n2026-02-30,Cafe,5\n2026-11-12,Shop,-3')
    expect(result.transactions).toHaveLength(1)
    expect(result.duplicates).toBe(1)
    expect(result.rejectedRows).toBe(2)
  })
  it('rejects missing headers and malformed quoting', () => {
    expect(() => previewBankCsv('date,amount\n2026-11-12,10')).toThrow()
    expect(() => previewBankCsv('date,merchant,amount\n2026-11-12,"oops,10')).toThrow()
  })
  it('flags transactions already recorded in the current account', () => {
    const first = previewBankCsv('date,merchant,amount\n2026-11-12,Cafe,10')
    const seen = new Set(first.transactions.map(t => t.fingerprint))
    const second = previewBankCsv('date,merchant,amount\n2026-11-12,Cafe,10', seen)
    expect(second.transactions).toHaveLength(0)
    expect(second.duplicates).toBe(1)
  })
  it('rejects invalid dates and non-positive amounts', () => {
    const result = previewBankCsv('date,merchant,amount\n2026-02-29,Shop,5\n2026-11-12,Shop,0\n2026-11-12,Shop,3.123')
    expect(result.transactions).toHaveLength(0)
    expect(result.rejectedRows).toBe(3)
  })
})
