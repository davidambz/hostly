import type { Booking } from '../../generated/prisma/client.js'
import { ExclusionConflictError } from '../../shared/database-errors.js'
import { nightsBetween, parseDate, today } from '../../shared/dates.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import { deleteOrFail } from '../../shared/owned-rows.js'
import type { Page } from '../../shared/pagination.js'
import type { BrokersRepository } from '../brokers/brokers.repository.js'
import type { PropertiesRepository } from '../properties/properties.repository.js'
import type { BookingData, BookingsRepository } from './bookings.repository.js'
import {
  type BookingWithRefs,
  type CalendarQuery,
  type CreateBookingInput,
  type ListBookingsQuery,
  MAX_NIGHTS,
  type UpdateBookingInput,
} from './bookings.schemas.js'

export interface BookingsServiceDeps {
  bookings: BookingsRepository
  properties: Pick<PropertiesRepository, 'find'>
  brokers: Pick<BrokersRepository, 'find'>
  /** Today as `YYYY-MM-DD`, in the business time zone. */
  today?: () => string
}

const notFound = () => new NotFoundError('Booking not found', { code: 'BOOKING_NOT_FOUND' })

/** The rules every booking must satisfy once all changes are applied. */
function assertValid(
  booking: Pick<Booking, 'checkIn' | 'checkOut' | 'brokerId' | 'brokerCommissionBps'>,
) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  if (nights < 1) {
    throw new BadRequestError('Check-out must be after check-in', {
      code: 'INVALID_DATES',
      details: { field: 'checkOut' },
    })
  }
  if (nights > MAX_NIGHTS) {
    throw new BadRequestError(`A booking can last at most ${MAX_NIGHTS} nights`, {
      code: 'INVALID_DATES',
      details: { field: 'checkOut' },
    })
  }
  if (booking.brokerId === null && booking.brokerCommissionBps > 0) {
    throw new BadRequestError('A commission needs a broker', {
      code: 'COMMISSION_WITHOUT_BROKER',
      details: { field: 'brokerCommissionBps' },
    })
  }
}

/** API input (dates as `YYYY-MM-DD`) to the columns it changes. */
function toData(input: UpdateBookingInput): Partial<BookingData> {
  const { checkIn, checkOut, ...rest } = input
  return {
    ...rest,
    ...(checkIn === undefined ? {} : { checkIn: parseDate(checkIn) }),
    ...(checkOut === undefined ? {} : { checkOut: parseDate(checkOut) }),
  }
}

export class BookingsService {
  private readonly today: () => string

  constructor(private readonly deps: BookingsServiceDeps) {
    this.today = deps.today ?? (() => today())
  }

  list(userId: string, query: ListBookingsQuery): Promise<Page<BookingWithRefs>> {
    return this.deps.bookings.list(userId, query, this.today())
  }

  calendar(userId: string, query: CalendarQuery): Promise<BookingWithRefs[]> {
    return this.deps.bookings.calendar(userId, query)
  }

  async get(userId: string, id: string): Promise<BookingWithRefs> {
    const booking = await this.deps.bookings.find(userId, id)
    if (!booking) {
      throw notFound()
    }
    return booking
  }

  async create(userId: string, input: CreateBookingInput): Promise<BookingWithRefs> {
    const data = toData(input) as BookingData
    assertValid(data as Booking)
    await this.assertOwned(userId, input)
    try {
      return await this.deps.bookings.create(userId, data)
    } catch (error) {
      throw await this.overlapOr(error, userId, data as Booking)
    }
  }

  /**
   * Partial update, checked against the booking as it ends up. Removing the broker without
   * saying anything about the commission drops the commission too.
   */
  async update(userId: string, id: string, input: UpdateBookingInput): Promise<BookingWithRefs> {
    await this.assertOwned(userId, input)
    let final: Booking | undefined
    try {
      const updated = await this.deps.bookings.update(userId, id, (current) => {
        const changes = toData(input)
        if (input.brokerId === null && input.brokerCommissionBps === undefined) {
          changes.brokerCommissionBps = 0
        }
        final = { ...current, ...changes } as Booking
        assertValid(final)
        return changes
      })
      if (!updated) {
        throw notFound()
      }
      return updated
    } catch (error) {
      throw final ? await this.overlapOr(error, userId, final, id) : error
    }
  }

  delete(userId: string, id: string): Promise<void> {
    return deleteOrFail(() => this.deps.bookings.delete(userId, id), {
      notFound,
      inUse: notFound,
    })
  }

  /** 404 for a property or broker the user doesn't have, before touching the booking. */
  private async assertOwned(
    userId: string,
    { propertyId, brokerId }: { propertyId?: string; brokerId?: string | null },
  ) {
    if (propertyId !== undefined && !(await this.deps.properties.find(userId, propertyId))) {
      throw new NotFoundError('Property not found', {
        code: 'PROPERTY_NOT_FOUND',
        details: { field: 'propertyId' },
      })
    }
    if (brokerId && !(await this.deps.brokers.find(userId, brokerId))) {
      throw new NotFoundError('Broker not found', {
        code: 'BROKER_NOT_FOUND',
        details: { field: 'brokerId' },
      })
    }
  }

  /** The 409 for an overlap, naming the booking in the way; any other error as is. */
  private async overlapOr(error: unknown, userId: string, booking: Booking, excludeId?: string) {
    if (!(error instanceof ExclusionConflictError)) {
      return error
    }
    const conflicting = await this.deps.bookings.findOverlapping(userId, booking, excludeId)
    return new ConflictError('The property is already booked on some of these nights', {
      code: 'BOOKING_OVERLAP',
      details: conflicting
        ? {
            conflictingBookingId: conflicting.id,
            checkIn: conflicting.checkIn.toISOString().slice(0, 10),
            checkOut: conflicting.checkOut.toISOString().slice(0, 10),
          }
        : undefined,
    })
  }
}
