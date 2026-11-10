import { describe, expect, it } from 'vitest'
import { addDays, addMonths, daysBetween, daysLeftInMonth, isISODate, monthElapsedRatio, monthRange, relativeDayLabel, toISODate } from './dates'

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isISODate('2026-02-28')).toBe(true)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('2026-2-3')).toBe(false)
  })
  it('counts days independent of DST', () => {
    expect(daysBetween('2026-11-10', '2026-11-13')).toBe(3)
    expect(daysBetween('2026-11-10', '2026-11-08')).toBe(-2)
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })
  it('adds months clamping to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-02-29'.replace('29', '28'), 12)).toBe('2027-02-28')
  })
  it('adds days across months/years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('computes month range and progress', () => {
    expect(monthRange('2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthElapsedRatio('2026-11-15')).toBe(0.5)
    expect(daysLeftInMonth('2026-11-30')).toBe(1)
  })
  it('formats local date', () => expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05'))
  it('relative labels in Saudi dialect', () => {
    expect(relativeDayLabel(0)).toBe('اليوم')
    expect(relativeDayLabel(1)).toBe('بكرة')
    expect(relativeDayLabel(2)).toBe('بعد يومين')
    expect(relativeDayLabel(5)).toBe('بعد 5 أيام')
    expect(relativeDayLabel(-3)).toBe('متأخر 3 أيام')
    expect(relativeDayLabel(20)).toBe('بعد 20 يوم')
  })
})
