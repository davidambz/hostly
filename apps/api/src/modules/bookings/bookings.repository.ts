import type { Booking, Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { ExclusionConflictError } from '../../shared/database-errors.js'
import { parseDate } from '../../shared/dates.js'
import { deleteOwnedRow, lockOwnedRow } from '../../shared/owned-rows.js'
import { type Page, toSkipTake } from '../../shared/pagination.js'
import { isExclusionViolation } from '../../shared/prisma-errors.js'
import { escapeLike } from '../../shared/search.js'
import type { BookingWithRefs, CalendarQuery, ListBookingsQuery } from './bookings.schemas.js'

export const OVERLAP_CONSTRAINT = 'bookings_no_overlap'

export type BookingData = Omit<Prisma.BookingUncheckedCreateInput, 'id' | 'userId'>

const withRefs = {
  property: { select: { id: true, name: true } },
  broker: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude

/** Rethrows an overlap as an ExclusionConflictError, anything else as is. */
function rethrow(error: unknown): never {
  if (isExclusionViolation(error, OVERLAP_CONSTRAINT)) {
    throw new ExclusionConflictError(OVERLAP_CONSTRAINT)
  }
  throw error
}

/** Every query is scoped to the owner: another user's booking simply doesn't exist here. */
export class BookingsRepository {
  constructor(private readonly db: Database) {}

  /** `today` is `YYYY-MM-DD`; a booking checking out today is still upcoming. */
  async list(
    userId: string,
    { status, propertyId, search, ...pagination }: ListBookingsQuery,
    today: string,
  ): Promise<Page<BookingWithRefs>> {
    const upcoming = status === 'upcoming'
    const where: Prisma.BookingWhereInput = {
      userId,
      checkOut: upcoming ? { gte: parseDate(today) } : { lt: parseDate(today) },
      ...(propertyId ? { propertyId } : {}),
      ...(search ? { guestName: { contains: escapeLike(search), mode: 'insensitive' } } : {}),
    }
    const order = upcoming ? 'asc' : 'desc'
    const [items, total] = await this.db.$transaction([
      this.db.booking.findMany({
        where,
        include: withRefs,
        orderBy: [{ checkIn: order }, { id: order }],
        ...toSkipTake(pagination),
      }),
      this.db.booking.count({ where }),
    ])
    return { items, total, ...pagination }
  }

  /** Every booking with a night inside [from, to). */
  calendar(userId: string, { from, to, propertyId }: CalendarQuery): Promise<BookingWithRefs[]> {
    return this.db.booking.findMany({
      where: {
        userId,
        checkIn: { lt: parseDate(to) },
        checkOut: { gt: parseDate(from) },
        ...(propertyId ? { propertyId } : {}),
      },
      include: withRefs,
      orderBy: [{ checkIn: 'asc' }, { id: 'asc' }],
    })
  }

  find(userId: string, id: string): Promise<BookingWithRefs | null> {
    return this.db.booking.findFirst({ where: { id, userId }, include: withRefs })
  }

  /** The user's booking on `propertyId` sharing a night with [checkIn, checkOut), if any. */
  findOverlapping(
    userId: string,
    { propertyId, checkIn, checkOut }: Pick<Booking, 'propertyId' | 'checkIn' | 'checkOut'>,
    excludeId?: string,
  ): Promise<Booking | null> {
    return this.db.booking.findFirst({
      where: {
        userId,
        propertyId,
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { checkIn: 'asc' },
    })
  }

  /** Throws ExclusionConflictError when the dates overlap another booking of the property. */
  async create(userId: string, data: BookingData): Promise<BookingWithRefs> {
    try {
      return await this.db.booking.create({ data: { ...data, userId }, include: withRefs })
    } catch (error) {
      rethrow(error)
    }
  }

  /**
   * Updates the booking with the changes `change` derives from its current state, in one
   * transaction with the row locked. Returns null when the user has no such booking;
   * whatever `change` throws aborts the update. Throws ExclusionConflictError on overlap.
   */
  async update(
    userId: string,
    id: string,
    change: (current: Booking) => Partial<BookingData>,
  ): Promise<BookingWithRefs | null> {
    try {
      return await this.db.$transaction(async (tx) => {
        if (!(await lockOwnedRow(tx, 'bookings', id, userId))) return null
        const booking = await tx.booking.findUniqueOrThrow({ where: { id } })
        return tx.booking.update({ where: { id }, data: change(booking), include: withRefs })
      })
    } catch (error) {
      rethrow(error)
    }
  }

  /** Nothing references a booking, so this only ever reports whether it existed. */
  delete(userId: string, id: string): Promise<boolean> {
    return deleteOwnedRow(() => this.db.booking.deleteMany({ where: { id, userId } }), 'nothing')
  }
}
