import type { Booking } from '../../generated/prisma/client.js'
import { ExclusionConflictError, MissingReferenceError } from '../../shared/database-errors.js'
import { formatDate, nightsBetween, parseDate, today } from '../../shared/dates.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
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

type BookingState = Pick<
  Booking,
  | 'checkIn'
  | 'checkOut'
  | 'nightlyRate'
  | 'cleaningFee'
  | 'discount'
  | 'amountPaid'
  | 'brokerId'
  | 'brokerCommissionBps'
>

const notFound = () => new NotFoundError('Booking not found', { code: 'BOOKING_NOT_FOUND' })

function invalid(message: string, code: string, field: string) {
  return new BadRequestError(message, { code, details: { field } })
}

/** The rules every booking must satisfy once all changes are applied. */
function assertValid(booking: BookingState) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  if (nights < 1) {
    throw invalid('Check-out must be after check-in', 'INVALID_DATES', 'checkOut')
  }
  if (nights > MAX_NIGHTS) {
    throw invalid(`A booking can last at most ${MAX_NIGHTS} nights`, 'INVALID_DATES', 'checkOut')
  }
  const lodging = nights * booking.nightlyRate
  if (booking.discount > lodging) {
    throw invalid('The discount is larger than the lodging', 'DISCOUNT_EXCEEDS_LODGING', 'discount')
  }
  if (booking.amountPaid > lodging - booking.discount + booking.cleaningFee) {
    throw invalid('The amount paid is larger than the total', 'PAYMENT_EXCEEDS_TOTAL', 'amountPaid')
  }
  if (booking.brokerId === null && booking.brokerCommissionBps > 0) {
    throw invalid('A commission needs a broker', 'COMMISSION_WITHOUT_BROKER', 'brokerCommissionBps')
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

const propertyNotFound = () =>
  new NotFoundError('Property not found', {
    code: 'PROPERTY_NOT_FOUND',
    details: { field: 'propertyId' },
  })

const brokerNotFound = () =>
  new NotFoundError('Broker not found', {
    code: 'BROKER_NOT_FOUND',
    details: { field: 'brokerId' },
  })

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
    const data = toData(input) as BookingData & BookingState
    assertValid(data)
    await this.assertOwned(userId, input)
    try {
      return await this.deps.bookings.create(userId, data)
    } catch (error) {
      throw await this.translate(error, userId, data as Booking)
    }
  }

  /**
   * Partial update, checked against the booking as it ends up. Removing the broker without
   * saying anything about the commission drops the commission too.
   */
  async update(userId: string, id: string, input: UpdateBookingInput): Promise<BookingWithRefs> {
    // The booking in the URL comes first: a missing one is a 404 whatever the body says.
    await this.get(userId, id)
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
      throw final ? await this.translate(error, userId, final, id) : error
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.deps.bookings.delete(userId, id))) {
      throw notFound()
    }
  }

  /** 404 for a property or broker the user doesn't have, before touching the booking. */
  private async assertOwned(
    userId: string,
    { propertyId, brokerId }: { propertyId?: string; brokerId?: string | null },
  ) {
    const [property, broker] = await Promise.all([
      propertyId === undefined ? true : this.deps.properties.find(userId, propertyId),
      brokerId ? this.deps.brokers.find(userId, brokerId) : true,
    ])
    if (!property) throw propertyNotFound()
    if (!broker) throw brokerNotFound()
  }

  /**
   * Data-layer errors to API errors: an overlap is a 409 naming the booking in the way; a
   * property or broker deleted since the ownership check is the same 404 as if it had
   * never been there. Anything else as is.
   */
  private async translate(error: unknown, userId: string, booking: Booking, excludeId?: string) {
    if (error instanceof MissingReferenceError) {
      return error.field === 'brokerId' ? brokerNotFound() : propertyNotFound()
    }
    if (!(error instanceof ExclusionConflictError)) {
      return error
    }
    const conflicting = await this.deps.bookings.findOverlapping(userId, booking, excludeId)
    return new ConflictError('The property is already booked on some of these nights', {
      code: 'BOOKING_OVERLAP',
      details: conflicting
        ? {
            conflictingBookingId: conflicting.id,
            checkIn: formatDate(conflicting.checkIn),
            checkOut: formatDate(conflicting.checkOut),
          }
        : undefined,
    })
  }
}
