import { describe, expect, it } from 'vitest'

import { depthOf, monthBounds, monthOccupancy } from './occupancy'

const stay = (propertyId: string, checkIn: string, checkOut: string) => ({
  checkIn,
  checkOut,
  property: { id: propertyId },
})

describe('monthBounds', () => {
  it.each([
    ['2027-01-14', { from: '2027-01-01', to: '2027-02-01' }],
    ['2026-12-31', { from: '2026-12-01', to: '2027-01-01' }],
    ['2028-02-29', { from: '2028-02-01', to: '2028-03-01' }],
  ])('%s → %j', (date, bounds) => {
    expect(monthBounds(date)).toEqual(bounds)
  })
})

describe('monthOccupancy', () => {
  it('adds up the nights of each property inside the month', () => {
    const { nights, days } = monthOccupancy('2027-01-14', [
      stay('casa', '2027-01-03', '2027-01-08'),
      stay('casa', '2027-01-10', '2027-01-12'),
      stay('ape', '2027-01-20', '2027-01-21'),
    ])

    expect(days).toBe(31)
    expect(Object.fromEntries(nights)).toEqual({ casa: 7, ape: 1 })
  })

  it('counts only the nights inside the month of a stay that crosses its edges', () => {
    const { nights } = monthOccupancy('2027-01-14', [
      // Dec 28 to Jan 3: Jan 1 and 2 are January's
      stay('casa', '2026-12-28', '2027-01-03'),
      // Jan 30 to Feb 4: Jan 30 and 31
      stay('ape', '2027-01-30', '2027-02-04'),
      // the whole month and more
      stay('chale', '2026-12-20', '2027-02-10'),
    ])

    expect(Object.fromEntries(nights)).toEqual({ casa: 2, ape: 2, chale: 31 })
  })

  it('ignores stays outside the month', () => {
    const { nights } = monthOccupancy('2027-01-14', [
      stay('casa', '2026-12-20', '2027-01-01'),
      stay('casa', '2027-02-01', '2027-02-05'),
    ])

    expect(nights.size).toBe(0)
  })
})

describe('depthOf', () => {
  it.each([
    [0, 31, 1],
    [1, 31, 2],
    [6, 30, 2],
    [7, 30, 3],
    [12, 30, 3],
    [18, 30, 4],
    [24, 30, 5],
    [29, 30, 5],
    [30, 30, 6],
    [3, 0, 1],
  ])('%i of %i nights → depth %i', (nights, days, depth) => {
    expect(depthOf(nights, days)).toBe(depth)
  })
})
