import { z } from 'zod'

import type { Booking } from '../../generated/prisma/client.js'
import { formatDate, nightsBetween, parseDate } from '../../shared/dates.js'
import { pageSchema, paginationQuerySchema } from '../../shared/pagination.js'
import { nameSchema } from '../../shared/validation/fields.js'
import { computeFinancials } from './booking-financials.js'

/** Longest stay accepted: a year. */
export const MAX_NIGHTS = 365
/** Longest window the calendar asks for at once (a year view). */
export const MAX_CALENDAR_DAYS = 366
/** R$ 10 million, in cents: far above any real stay, well inside a 32-bit integer. */
export const MAX_AMOUNT_CENTS = 1_000_000_000

const dateSchema = z.iso.date()
const centsSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS)
/** Basis points: 1000 = 10%. */
const bpsSchema = z.number().int().min(0).max(10_000)

const bookingFields = {
  propertyId: z.uuid(),
  brokerId: z.uuid().nullable(),
  guestName: nameSchema,
  /** `YYYY-MM-DD`. */
  checkIn: dateSchema,
  /** `YYYY-MM-DD`, after check-in. The check-out day is free for the next check-in. */
  checkOut: dateSchema,
  /** Cents per night. */
  nightlyRate: centsSchema,
  /** Cents. */
  cleaningFee: centsSchema,
  /** Cents off the lodging. */
  discount: centsSchema,
  /** Cents the guest already paid. */
  amountPaid: centsSchema,
  /** The broker's commission in basis points (1000 = 10%); needs a broker. */
  brokerCommissionBps: bpsSchema,
}

/**
 * Rules across fields (dates, discount vs lodging, payment vs total, commission needs a
 * broker) are checked by the service, against the booking as it ends up.
 */
export const createBookingBodySchema = z.object({
  ...bookingFields,
  brokerId: bookingFields.brokerId.default(null),
  cleaningFee: centsSchema.default(0),
  discount: centsSchema.default(0),
  amountPaid: centsSchema.default(0),
  brokerCommissionBps: bpsSchema.default(0),
})

export type CreateBookingInput = z.infer<typeof createBookingBodySchema>

export const updateBookingBodySchema = z
  .object(bookingFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

export type UpdateBookingInput = z.infer<typeof updateBookingBodySchema>

export const bookingIdParamsSchema = z.object({ id: z.uuid() })

export const listBookingsQuerySchema = paginationQuerySchema.extend({
  /** upcoming: check-out today or later, soonest first; past: before today, latest first. */
  status: z.enum(['upcoming', 'past']).default('upcoming'),
  propertyId: z.uuid().optional(),
  /** Part of the guest's name, any case. */
  search: z.string().trim().max(255).optional(),
})

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>

export const calendarQuerySchema = z
  .object({
    /** First day of the window, `YYYY-MM-DD`. */
    from: dateSchema,
    /** Day after the last one, `YYYY-MM-DD` (exclusive). */
    to: dateSchema,
    propertyId: z.uuid().optional(),
  })
  .refine(({ from, to }) => from < to, { path: ['to'], message: 'Must be after from' })
  .refine(({ from, to }) => nightsBetween(parseDate(from), parseDate(to)) <= MAX_CALENDAR_DAYS, {
    path: ['to'],
    message: `At most ${MAX_CALENDAR_DAYS} days`,
  })

export type CalendarQuery = z.infer<typeof calendarQuerySchema>

/** Body of POST /bookings/quote: the money and dates of a booking, nothing else. */
export const quoteBodySchema = z.object({
  /** Only whether there is one matters: a commission needs a broker. */
  brokerId: z.uuid().nullable().default(null),
  checkIn: dateSchema,
  checkOut: dateSchema,
  nightlyRate: centsSchema,
  cleaningFee: centsSchema.default(0),
  discount: centsSchema.default(0),
  amountPaid: centsSchema.default(0),
  brokerCommissionBps: bpsSchema.default(0),
})

export type QuoteInput = z.infer<typeof quoteBodySchema>

const cents = z.number().int()

/** See booking-financials.ts for how each value is worked out. */
export const financialsSchema = z
  .object({
    grossLodging: cents,
    lodging: cents,
    total: cents,
    brokerFee: cents,
    net: cents,
    balanceDue: cents,
  })
  .meta({ id: 'BookingFinancials' })

const reference = z.object({ id: z.uuid(), name: z.string() })

export const bookingSchema = z
  .object({
    id: z.uuid(),
    property: reference,
    broker: reference.nullable(),
    guestName: z.string(),
    checkIn: dateSchema,
    checkOut: dateSchema,
    nights: z.number().int(),
    nightlyRate: z.number().int(),
    cleaningFee: z.number().int(),
    discount: z.number().int(),
    amountPaid: z.number().int(),
    brokerCommissionBps: z.number().int(),
    financials: financialsSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Booking' })

export const bookingPageSchema = pageSchema(bookingSchema).meta({ id: 'BookingPage' })

export type PublicBooking = z.infer<typeof bookingSchema>

/** A booking with the names the API shows alongside it. */
export type BookingWithRefs = Booking & {
  property: { id: string; name: string }
  broker: { id: string; name: string } | null
}

export function toPublicBooking(booking: BookingWithRefs): PublicBooking {
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  return {
    id: booking.id,
    property: booking.property,
    broker: booking.broker,
    guestName: booking.guestName,
    checkIn: formatDate(booking.checkIn),
    checkOut: formatDate(booking.checkOut),
    nights,
    nightlyRate: booking.nightlyRate,
    cleaningFee: booking.cleaningFee,
    discount: booking.discount,
    amountPaid: booking.amountPaid,
    brokerCommissionBps: booking.brokerCommissionBps,
    financials: computeFinancials({
      nights,
      nightlyRate: booking.nightlyRate,
      cleaningFee: booking.cleaningFee,
      discount: booking.discount,
      amountPaid: booking.amountPaid,
      brokerCommissionBps: booking.brokerCommissionBps,
    }),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  }
}
