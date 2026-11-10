import { describe, expect, it } from 'vitest'
import { formatSAR, normalizeDigits, parseAmount, roundMoney } from './money'

describe('money', () => {
  it('parses Latin and Arabic-Indic digits', () => {
    expect(parseAmount('150')).toBe(150)
    expect(parseAmount('١٥٠')).toBe(150)
    expect(parseAmount('٤٥٫٥')).toBe(45.5)
    expect(parseAmount('1,500.25')).toBe(1500.25)
    expect(parseAmount(' ۲۰ ')).toBe(20)
  })
  it('rejects invalid, negative, zero and >2 decimals', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '0', '100000001']) expect(parseAmount(bad)).toBeNull()
    expect(parseAmount('0', { allowZero: true })).toBe(0)
  })
  it('rounds money to 2 decimals', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(1.005)).toBe(1.01)
  })
  it('formats SAR with Latin digits', () => {
    expect(formatSAR(1500)).toMatch(/1,?500/)
    expect(formatSAR(1500)).toContain('ر.س')
    expect(formatSAR(Number.NaN)).toContain('0')
  })
  it('normalizes digits', () => expect(normalizeDigits('١٢٣٫٤')).toBe('123.4'))
})
