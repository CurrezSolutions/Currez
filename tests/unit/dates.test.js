import { describe, it, expect } from 'vitest'
import { todayDateString, shiftDateString } from '../../src/utils/dates.js'

describe('utils/dates.js', () => {
  it('formats a local date as zero-padded YYYY-MM-DD', () => {
    expect(todayDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayDateString(new Date(2026, 10, 22))).toBe('2026-11-22')
  })

  it('shiftDateString moves forward/backward by N calendar days, crossing month/year boundaries', () => {
    const date = new Date(2026, 0, 5)
    expect(shiftDateString(1, date)).toBe('2026-01-06')
    expect(shiftDateString(-5, date)).toBe('2025-12-31')
  })

  it('does not mutate the date object passed in', () => {
    const date = new Date(2026, 0, 5)
    shiftDateString(10, date)
    expect(date.getDate()).toBe(5)
  })
})
