import { describe, expect, it } from 'vitest'

import { formatNearDay } from './dates'
import { monthMoney, upcomingMoves } from './month-summary'

const stay = (
  id: string,
  checkIn: string,
  checkOut: string,
  money: { total?: number; paid?: number; due?: number; fee?: number } = {},
) => ({
  id,
  checkIn,
  checkOut,
  amountPaid: money.paid ?? 0,
  financials: { total: money.total ?? 0, balanceDue: money.due ?? 0, brokerFee: money.fee ?? 0 },
})

describe('monthMoney', () => {
  it('adds up the bookings that check in during the month, whole', () => {
    const money = monthMoney('2027-01-14', [
      stay('a', '2027-01-03', '2027-01-08', {
        total: 300000,
        paid: 100000,
        due: 200000,
        fee: 30000,
      }),
      // Crosses into February: still all January's.
      stay('b', '2027-01-30', '2027-02-04', { total: 150000, paid: 150000, due: 0 }),
      // Began in December: December's.
      stay('c', '2026-12-28', '2027-01-03', { total: 999999 }),
      stay('d', '2027-02-01', '2027-02-03', { total: 999999 }),
    ])

    expect(money).toEqual({
      bookings: 2,
      total: 450000,
      paid: 250000,
      due: 200000,
      fees: 30000,
    })
  })

  it('is all zeros for an empty month', () => {
    expect(monthMoney('2027-01-14', [])).toEqual({
      bookings: 0,
      total: 0,
      paid: 0,
      due: 0,
      fees: 0,
    })
  })
})

describe('upcomingMoves', () => {
  it('lists arrivals and departures from today on, by date, arrivals first on a day', () => {
    const moves = upcomingMoves('2027-01-10', [
      stay('leaves-today', '2027-01-05', '2027-01-10'),
      stay('arrives-today', '2027-01-10', '2027-01-20'),
      stay('turnover', '2027-01-12', '2027-01-14'),
      stay('too-late', '2027-01-17', '2027-01-19'),
      stay('gone', '2027-01-01', '2027-01-09'),
    ])

    expect(moves.map((move) => `${move.date} ${move.kind} ${move.stay.id}`)).toEqual([
      '2027-01-10 arrival arrives-today',
      '2027-01-10 departure leaves-today',
      '2027-01-12 arrival turnover',
      '2027-01-14 departure turnover',
    ])
  })
})

describe('formatNearDay', () => {
  it.each([
    ['2027-01-10', 'Hoje'],
    ['2027-01-11', 'Amanhã'],
    ['2027-01-15', 'sex, 15 jan'],
  ])('%s → %s', (date, label) => {
    expect(formatNearDay(date, '2027-01-10')).toBe(label)
  })
})
