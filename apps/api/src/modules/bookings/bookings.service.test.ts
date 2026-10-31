import { describe, expect, it, vi } from 'vitest'

import type { Booking } from '../../generated/prisma/client.js'
import { ExclusionConflictError } from '../../shared/database-errors.js'
import { parseDate } from '../../shared/dates.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import type { BookingsRepository } from './bookings.repository.js'
import type { CreateBookingInput } from './bookings.schemas.js'
import { BookingsService } from './bookings.service.js'

const stored: Booking = {
  id: 'bk1',
  userId: 'u1',
  propertyId: 'p1',
  brokerId: 'br1',
  guestName: 'Mariana',
  checkIn: parseDate('2026-12-20'),
  checkOut: parseDate('2026-12-27'),
  nightlyRate: 45_000,
  cleaningFee: 0,
  discount: 0,
  amountPaid: 0,
  brokerCommissionBps: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const input: CreateBookingInput = {
  propertyId: 'p1',
  brokerId: null,
  guestName: 'Mariana',
  checkIn: '2026-12-20',
  checkOut: '2026-12-27',
  nightlyRate: 45_000,
  cleaningFee: 0,
  discount: 0,
  amountPaid: 0,
  brokerCommissionBps: 0,
}

function setup() {
  const refs = { property: { id: 'p1', name: 'Casa' }, broker: null }
  const bookings = {
    current: stored as Booking | null,
    list: vi.fn(),
    calendar: vi.fn(),
    find: vi.fn(),
    findOverlapping: vi.fn<() => Promise<Booking | null>>().mockResolvedValue(null),
    create: vi.fn((_u: string, data: object) => Promise.resolve({ ...stored, ...data, ...refs })),
    update: vi.fn((_u: string, _id: string, change: (current: Booking) => Partial<Booking>) => {
      const current = bookings.current
      return Promise.resolve(current ? { ...current, ...change(current), ...refs } : null)
    }),
    delete: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  }
  const properties = { find: vi.fn().mockResolvedValue({ id: 'p1' }) }
  const brokers = { find: vi.fn().mockResolvedValue({ id: 'br1' }) }
  const service = new BookingsService({
    bookings: bookings as unknown as BookingsRepository,
    properties,
    brokers,
    today: () => '2026-11-01',
  })
  return { bookings, properties, brokers, service }
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected a rejection')
    },
    (error: unknown) => error,
  )
}

describe('BookingsService.list', () => {
  it("passes today's date in the business time zone", async () => {
    const { bookings, service } = setup()

    await service.list('u1', { status: 'upcoming', page: 1, pageSize: 20 })

    expect(bookings.list).toHaveBeenCalledWith('u1', expect.anything(), '2026-11-01')
  })
})

describe('BookingsService.create', () => {
  it('stores the dates as date-only values', async () => {
    const { bookings, service } = setup()

    await service.create('u1', input)

    expect(bookings.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        checkIn: parseDate('2026-12-20'),
        checkOut: parseDate('2026-12-27'),
      }),
    )
  })

  it.each([
    ['check-out on the check-in day', { checkOut: '2026-12-20' }, 'INVALID_DATES'],
    ['check-out before check-in', { checkOut: '2026-12-10' }, 'INVALID_DATES'],
    ['a stay longer than a year', { checkOut: '2027-12-21' }, 'INVALID_DATES'],
    ['a commission without a broker', { brokerCommissionBps: 500 }, 'COMMISSION_WITHOUT_BROKER'],
  ])('answers 400 for %s, before any lookup', async (_case, change, code) => {
    const { bookings, properties, service } = setup()

    const error = await failure(service.create('u1', { ...input, ...change }))

    expect(error).toBeInstanceOf(BadRequestError)
    expect(error).toMatchObject({ code })
    expect(properties.find).not.toHaveBeenCalled()
    expect(bookings.create).not.toHaveBeenCalled()
  })

  it('accepts exactly a year', async () => {
    const { service } = setup()

    await expect(service.create('u1', { ...input, checkOut: '2027-12-20' })).resolves.toBeDefined()
  })

  it("answers 404 PROPERTY_NOT_FOUND for a property the user doesn't have", async () => {
    const { properties, bookings, service } = setup()
    properties.find.mockResolvedValue(null)

    const error = await failure(service.create('u1', input))

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ code: 'PROPERTY_NOT_FOUND', details: { field: 'propertyId' } })
    expect(bookings.create).not.toHaveBeenCalled()
  })

  it("answers 404 BROKER_NOT_FOUND for a broker the user doesn't have", async () => {
    const { brokers, service } = setup()
    brokers.find.mockResolvedValue(null)

    await expect(
      service.create('u1', { ...input, brokerId: 'br9', brokerCommissionBps: 500 }),
    ).rejects.toMatchObject({ code: 'BROKER_NOT_FOUND', details: { field: 'brokerId' } })
  })

  it('answers 409 BOOKING_OVERLAP naming the booking in the way', async () => {
    const { bookings, service } = setup()
    bookings.create.mockRejectedValue(new ExclusionConflictError('bookings_no_overlap'))
    bookings.findOverlapping.mockResolvedValue(stored)

    const error = await failure(service.create('u1', input))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({
      code: 'BOOKING_OVERLAP',
      details: { conflictingBookingId: 'bk1', checkIn: '2026-12-20', checkOut: '2026-12-27' },
    })
  })

  it('still answers 409 if the booking in the way is gone by the time it is looked up', async () => {
    const { bookings, service } = setup()
    bookings.create.mockRejectedValue(new ExclusionConflictError('bookings_no_overlap'))

    await expect(service.create('u1', input)).rejects.toMatchObject({
      code: 'BOOKING_OVERLAP',
      details: undefined,
    })
  })

  it('lets other errors through', async () => {
    const { bookings, service } = setup()
    const failureCause = new Error('connection reset')
    bookings.create.mockRejectedValue(failureCause)

    await expect(service.create('u1', input)).rejects.toBe(failureCause)
  })
})

describe('BookingsService.update', () => {
  it('applies the changes to the stored booking', async () => {
    const { service } = setup()

    const updated = await service.update('u1', 'bk1', { checkOut: '2026-12-28', guestName: 'Mari' })

    expect(updated).toMatchObject({ checkOut: parseDate('2026-12-28'), guestName: 'Mari' })
  })

  it('validates against the booking as it ends up', async () => {
    const { service } = setup()

    // Only check-out is sent, and it lands before the stored check-in.
    await expect(service.update('u1', 'bk1', { checkOut: '2026-12-19' })).rejects.toMatchObject({
      code: 'INVALID_DATES',
    })
  })

  it('drops the commission when the broker is removed without a word about it', async () => {
    const { service } = setup()

    const updated = await service.update('u1', 'bk1', { brokerId: null })

    expect(updated).toMatchObject({ brokerId: null, brokerCommissionBps: 0 })
  })

  it('rejects removing the broker while sending a commission', async () => {
    const { service } = setup()

    await expect(
      service.update('u1', 'bk1', { brokerId: null, brokerCommissionBps: 500 }),
    ).rejects.toMatchObject({ code: 'COMMISSION_WITHOUT_BROKER' })
  })

  it('checks ownership of a new property and broker', async () => {
    const { properties, brokers, service } = setup()

    await service.update('u1', 'bk1', { propertyId: 'p2', brokerId: 'br2' })

    expect(properties.find).toHaveBeenCalledWith('u1', 'p2')
    expect(brokers.find).toHaveBeenCalledWith('u1', 'br2')
  })

  it('does not look up the property or broker when they do not change', async () => {
    const { properties, brokers, service } = setup()

    await service.update('u1', 'bk1', { guestName: 'X' })

    expect(properties.find).not.toHaveBeenCalled()
    expect(brokers.find).not.toHaveBeenCalled()
  })

  it('answers 404 BOOKING_NOT_FOUND when the booking is missing', async () => {
    const { bookings, service } = setup()
    bookings.current = null

    await expect(service.update('u1', 'bk1', { guestName: 'X' })).rejects.toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    })
  })

  it('answers 409 on overlap, looking for the conflict among the other bookings', async () => {
    const { bookings, service } = setup()
    bookings.update.mockImplementationOnce((_u, _id, change) => {
      change(stored)
      return Promise.reject(new ExclusionConflictError('bookings_no_overlap'))
    })

    const error = await failure(service.update('u1', 'bk1', { checkOut: '2026-12-30' }))

    expect(error).toMatchObject({ code: 'BOOKING_OVERLAP' })
    expect(bookings.findOverlapping).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ checkOut: parseDate('2026-12-30') }),
      'bk1',
    )
  })
})

describe('BookingsService.delete', () => {
  it('answers 404 when there is nothing to delete', async () => {
    const { bookings, service } = setup()
    bookings.delete.mockResolvedValue(false)

    await expect(service.delete('u1', 'bk1')).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND' })
  })
})
