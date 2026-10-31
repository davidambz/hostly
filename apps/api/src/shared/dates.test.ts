import { describe, expect, it } from 'vitest'

import { addDays, formatDate, nightsBetween, parseDate, today } from './dates.js'

describe('date-only values', () => {
  it('parse to UTC midnight and format back', () => {
    const date = parseDate('2026-12-31')

    expect(date.toISOString()).toBe('2026-12-31T00:00:00.000Z')
    expect(formatDate(date)).toBe('2026-12-31')
  })

  it.each([
    ['2026-01-01', '2026-01-02', 1],
    ['2026-01-01', '2026-01-08', 7],
    ['2026-02-27', '2026-03-01', 2],
    ['2028-02-28', '2028-03-01', 2],
    ['2026-12-30', '2027-01-02', 3],
    ['2026-01-05', '2026-01-05', 0],
    ['2026-01-05', '2026-01-03', -2],
  ])('%s → %s is %i nights', (checkIn, checkOut, nights) => {
    expect(nightsBetween(parseDate(checkIn), parseDate(checkOut))).toBe(nights)
  })

  it('counts nights right across the start of daylight saving time in Brazil', () => {
    // Dates are UTC midnights, so DST in any zone can't shift them.
    expect(nightsBetween(parseDate('2018-11-03'), parseDate('2018-11-05'))).toBe(2)
  })

  it('adds days', () => {
    expect(formatDate(addDays(parseDate('2026-12-30'), 3))).toBe('2027-01-02')
  })
})

describe('today', () => {
  it("is São Paulo's date, which lags UTC's after 21h", () => {
    const lateNightUtc = new Date('2026-11-01T02:30:00Z') // 23:30 on Oct 31 in São Paulo

    expect(today('America/Sao_Paulo', lateNightUtc)).toBe('2026-10-31')
    expect(today('UTC', lateNightUtc)).toBe('2026-11-01')
  })

  it('defaults to São Paulo and now', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
