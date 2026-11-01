import { describe, expect, it } from 'vitest'

import {
  addDaysISO,
  addMonthsISO,
  formatLongDate,
  formatMonth,
  formatShortDate,
  formatStay,
  monthWeeks,
  nightsBetween,
  nightsLabel,
  todayISO,
  validDateOrNull,
  weekDays,
} from './dates'

describe('dates', () => {
  it('is today in Brazil, whatever the browser time zone', () => {
    // 01:30 UTC on Nov 2 is still Nov 1 in São Paulo (UTC−3).
    expect(todayISO(new Date('2026-11-02T01:30:00Z'))).toBe('2026-11-01')
    expect(todayISO(new Date('2026-11-02T03:30:00Z'))).toBe('2026-11-02')
  })

  it('does date arithmetic on YYYY-MM-DD strings', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsISO('2026-01-15', -1)).toBe('2025-12-15')
    expect(nightsBetween('2026-11-28', '2026-12-02')).toBe(4)
  })

  it.each([
    ['2026-11-12', '2026-11-15', '12 – 15 nov 2026'],
    ['2026-10-29', '2026-11-03', '29 out – 3 nov 2026'],
    ['2026-12-28', '2027-01-02', '28 dez 2026 – 2 jan 2027'],
  ])('formatStay(%s, %s) → %s', (checkIn, checkOut, text) => {
    expect(formatStay(checkIn, checkOut)).toBe(text)
  })

  it('formats for the screen and for screen readers', () => {
    expect(formatShortDate('2026-11-05')).toBe('05/11')
    expect(formatLongDate('2026-11-05')).toBe('5 de novembro de 2026')
    expect(formatMonth('2026-11-05')).toBe('novembro de 2026')
    expect([nightsLabel(1), nightsLabel(3)]).toEqual(['1 noite', '3 noites'])
  })

  it('lays a month out in whole weeks, Sunday first', () => {
    const weeks = monthWeeks('2026-11-15')

    expect(weeks).toHaveLength(5)
    expect(weeks[0]?.[0]).toBe('2026-11-01')
    expect(weeks[4]?.[6]).toBe('2026-12-05')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('takes leading days from the month before', () => {
    expect(monthWeeks('2026-12-10')[0]?.slice(0, 3)).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
    ])
  })

  it('gives the week of a day, Sunday to Saturday', () => {
    expect(weekDays('2026-11-11')).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ])
  })

  it.each([
    ['2026-11-05', '2026-11-05'],
    [null, null],
    ['amanhã', null],
    ['2026-13-45', null],
  ])('validDateOrNull(%j) → %j', (value, result) => {
    expect(validDateOrNull(value)).toBe(result)
  })
})
