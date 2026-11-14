import { describe, expect, it } from 'vitest'

import { parseDate } from '../../shared/dates.js'
import { performance, type ReportBooking, sliceOf } from './performance.js'

const d = parseDate

function booking(overrides: Partial<ReportBooking> = {}): ReportBooking {
  return {
    propertyId: 'p1',
    brokerId: null,
    checkIn: d('2026-11-28'),
    checkOut: d('2026-12-03'),
    nightlyRate: 10_000,
    cleaningFee: 0,
    discount: 0,
    brokerCommissionBps: 0,
    ...overrides,
  }
}

describe('sliceOf', () => {
  it('counts only the nights inside the period, with their part of the lodging', () => {
    const slice = sliceOf(booking(), d('2026-12-01'), d('2027-01-01'))

    expect(slice).toMatchObject({ nights: 2, lodging: 20_000, checksIn: false, stayNights: 5 })
  })

  it('splits odd amounts so the parts add up to the whole, to the cent', () => {
    // 3 nights, 100,00 of lodging after the discount, 12,5% to the broker.
    const odd = booking({
      checkIn: d('2026-11-30'),
      checkOut: d('2026-12-03'),
      nightlyRate: 3_334,
      discount: 2,
      brokerId: 'b1',
      brokerCommissionBps: 1_250,
    })
    const november = sliceOf(odd, d('2026-11-01'), d('2026-12-01'))
    const december = sliceOf(odd, d('2026-12-01'), d('2027-01-01'))
    const firstDay = sliceOf(odd, d('2026-12-01'), d('2026-12-02'))
    const rest = sliceOf(odd, d('2026-12-02'), d('2027-01-01'))

    expect(november.lodging + december.lodging).toBe(10_000)
    expect(november.brokerFee + december.brokerFee).toBe(1_250)
    expect(firstDay.lodging + rest.lodging).toBe(december.lodging)
    expect([november.lodging, firstDay.lodging, rest.lodging]).toEqual([3_333, 3_333, 3_334])
  })

  it('puts the cleaning fee on the check-in day', () => {
    const withCleaning = booking({ cleaningFee: 15_000 })

    expect(sliceOf(withCleaning, d('2026-11-01'), d('2026-12-01'))).toMatchObject({
      cleaning: 15_000,
      checksIn: true,
    })
    expect(sliceOf(withCleaning, d('2026-12-01'), d('2027-01-01')).cleaning).toBe(0)
  })

  it('charges no fee without a broker, whatever the commission says', () => {
    const slice = sliceOf(booking({ brokerCommissionBps: 1_000 }), d('2026-11-01'), d('2027-01-01'))

    expect(slice.brokerFee).toBe(0)
  })

  it('gives nothing for a period the booking does not touch', () => {
    expect(sliceOf(booking(), d('2027-01-01'), d('2027-02-01'))).toMatchObject({
      nights: 0,
      lodging: 0,
      checksIn: false,
    })
  })
})

describe('performance', () => {
  const properties = [
    { id: 'p1', name: 'Casa da Praia' },
    { id: 'p2', name: 'Apartamento Centro' },
  ]
  const from = d('2026-12-01')
  const to = d('2026-12-11') // 10 days

  it('adds up each property and the total, listing the ones without bookings', () => {
    const report = performance(
      properties,
      [
        booking(), // 2 nights in the period
        booking({
          checkIn: d('2026-12-05'),
          checkOut: d('2026-12-08'),
          nightlyRate: 20_000,
          cleaningFee: 5_000,
          brokerId: 'b1',
          brokerCommissionBps: 1_000,
        }),
      ],
      from,
      to,
    )

    expect(report.days).toBe(10)
    expect(report.properties[0]).toEqual({
      id: 'p1',
      name: 'Casa da Praia',
      nightsAvailable: 10,
      nightsSold: 5,
      occupancyBps: 5_000,
      lodging: 80_000,
      cleaning: 5_000,
      revenue: 85_000,
      brokerFees: 6_000,
      net: 79_000,
      averageDailyRate: 16_000,
      revpar: 8_000,
      bookings: 1,
      averageStay: 3,
    })
    expect(report.properties[1]).toMatchObject({
      id: 'p2',
      nightsSold: 0,
      occupancyBps: 0,
      averageDailyRate: null,
      averageStay: null,
    })
    expect(report.total).toMatchObject({
      nightsAvailable: 20,
      nightsSold: 5,
      occupancyBps: 2_500,
      revenue: 85_000,
      revpar: 4_000,
    })
  })

  it('ignores bookings of properties it was not given', () => {
    const report = performance(properties, [booking({ propertyId: 'other' })], from, to)

    expect(report.total.nightsSold).toBe(0)
  })

  it('reports zeros without properties', () => {
    expect(performance([], [], from, to).total).toMatchObject({
      nightsAvailable: 0,
      occupancyBps: 0,
      revpar: 0,
    })
  })
})
