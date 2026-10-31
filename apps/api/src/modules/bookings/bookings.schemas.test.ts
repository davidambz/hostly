import { describe, expect, it } from 'vitest'

import {
  bookingSchema,
  calendarQuerySchema,
  createBookingBodySchema,
  listBookingsQuerySchema,
  MAX_AMOUNT_CENTS,
  toPublicBooking,
  updateBookingBodySchema,
} from './bookings.schemas.js'

const PROPERTY = '018f0000-0000-7000-8000-000000000001'
const valid = {
  propertyId: PROPERTY,
  guestName: ' Mariana Costa ',
  checkIn: '2026-12-20',
  checkOut: '2026-12-27',
  nightlyRate: 45_000,
}

describe('createBookingBodySchema', () => {
  it('fills the optional amounts with zero and the broker with null', () => {
    expect(createBookingBodySchema.parse(valid)).toEqual({
      ...valid,
      guestName: 'Mariana Costa',
      brokerId: null,
      cleaningFee: 0,
      discount: 0,
      amountPaid: 0,
      brokerCommissionBps: 0,
    })
  })

  it.each([
    ['a date in another format', { checkIn: '20/12/2026' }],
    ['an impossible date', { checkOut: '2026-02-30' }],
    ['a negative amount', { cleaningFee: -1 }],
    ['an amount in reais instead of cents', { nightlyRate: 450.5 }],
    ['an amount above the cap', { discount: MAX_AMOUNT_CENTS + 1 }],
    ['a commission above 100%', { brokerCommissionBps: 10_001 }],
    ['a property id that is not a UUID', { propertyId: '1' }],
    ['a blank guest name', { guestName: ' ' }],
  ])('rejects %s', (_case, change) => {
    expect(createBookingBodySchema.safeParse({ ...valid, ...change }).success).toBe(false)
  })

  it.each(['propertyId', 'guestName', 'checkIn', 'checkOut', 'nightlyRate'])(
    'requires %s',
    (field) => {
      const { [field as keyof typeof valid]: _omitted, ...body } = valid

      expect(createBookingBodySchema.safeParse(body).success).toBe(false)
    },
  )
})

describe('updateBookingBodySchema', () => {
  it('takes any subset and keeps null to remove the broker', () => {
    expect(updateBookingBodySchema.parse({ brokerId: null })).toEqual({ brokerId: null })
  })

  it('rejects an empty update', () => {
    expect(updateBookingBodySchema.safeParse({}).success).toBe(false)
  })
})

describe('listBookingsQuerySchema', () => {
  it('defaults to upcoming, first page', () => {
    expect(listBookingsQuerySchema.parse({})).toEqual({ status: 'upcoming', page: 1, pageSize: 20 })
  })

  it('rejects an unknown status', () => {
    expect(listBookingsQuerySchema.safeParse({ status: 'all' }).success).toBe(false)
  })
})

describe('calendarQuerySchema', () => {
  it('accepts a month', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-12-01', to: '2027-01-01' }).success).toBe(
      true,
    )
  })

  it('accepts a full leap year (366 days)', () => {
    expect(calendarQuerySchema.safeParse({ from: '2028-01-01', to: '2029-01-01' }).success).toBe(
      true,
    )
  })

  it.each([
    ['an empty window', { from: '2026-12-01', to: '2026-12-01' }],
    ['a reversed window', { from: '2026-12-10', to: '2026-12-01' }],
    ['more than 366 days', { from: '2026-01-01', to: '2027-01-03' }],
    ['a missing end', { from: '2026-12-01' }],
  ])('rejects %s', (_case, query) => {
    expect(calendarQuerySchema.safeParse(query).success).toBe(false)
  })
})

describe('toPublicBooking', () => {
  const booking = {
    id: '018f0000-0000-7000-8000-0000000000b1',
    userId: '018f0000-0000-7000-8000-0000000000aa',
    propertyId: PROPERTY,
    brokerId: null,
    guestName: 'Mariana',
    checkIn: new Date('2026-12-20T00:00:00Z'),
    checkOut: new Date('2026-12-27T00:00:00Z'),
    nightlyRate: 45_000,
    cleaningFee: 0,
    discount: 0,
    amountPaid: 0,
    brokerCommissionBps: 0,
    createdAt: new Date('2026-10-31T12:00:00Z'),
    updatedAt: new Date('2026-10-31T12:00:00Z'),
    property: { id: PROPERTY, name: 'Casa' },
    broker: null,
  }

  it('includes the financials', () => {
    expect(
      toPublicBooking({ ...booking, cleaningFee: 25_000, brokerCommissionBps: 0 }).financials,
    ).toEqual({
      nights: 7,
      grossLodging: 315_000,
      discount: 0,
      lodging: 315_000,
      cleaningFee: 25_000,
      total: 340_000,
      brokerFee: 0,
      net: 340_000,
      amountPaid: 0,
      balanceDue: 340_000,
    })
  })

  it('shows dates as YYYY-MM-DD, the nights, and the property name, without the owner', () => {
    const output = toPublicBooking(booking)

    expect(output).toMatchObject({
      checkIn: '2026-12-20',
      checkOut: '2026-12-27',
      nights: 7,
      property: { id: PROPERTY, name: 'Casa' },
      broker: null,
    })
    expect(output).not.toHaveProperty('userId')
    expect(output).not.toHaveProperty('propertyId')
    expect(bookingSchema.safeParse(output).success).toBe(true)
  })
})
