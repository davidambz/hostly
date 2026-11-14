import { z } from 'zod'

import { nightsBetween, parseDate } from '../../shared/dates.js'

/** The longest period a report covers: two years and a leap day. */
export const MAX_REPORT_DAYS = 731

const period = z.object({
  /** First day, `YYYY-MM-DD`. */
  from: z.iso.date(),
  /** Day after the last one, `YYYY-MM-DD` (exclusive). */
  to: z.iso.date(),
})

/** `to` after `from`, and at most MAX_REPORT_DAYS apart. */
function checkedPeriod<T extends typeof period>(schema: T) {
  return schema
    .refine(({ from, to }) => from < to, { path: ['to'], message: 'Must be after from' })
    .refine(({ from, to }) => nightsBetween(parseDate(from), parseDate(to)) <= MAX_REPORT_DAYS, {
      path: ['to'],
      message: `At most ${String(MAX_REPORT_DAYS)} days`,
    })
}

export const periodQuerySchema = checkedPeriod(period)

const cents = z.number().int()

export const figuresSchema = z
  .object({
    nightsAvailable: z.number().int().describe('Days of the period × properties'),
    nightsSold: z.number().int(),
    occupancyBps: z.number().int().describe('Nights sold ÷ available, in basis points'),
    lodging: cents.describe('Lodging of the nights inside the period, spread per night'),
    cleaning: cents.describe('Cleaning fees of the bookings checking in during the period'),
    revenue: cents.describe('Lodging + cleaning'),
    brokerFees: cents,
    net: cents.describe('Revenue − broker fees'),
    averageDailyRate: cents.nullable().describe('Lodging ÷ nights sold'),
    revpar: cents.describe('Lodging ÷ nights available'),
    bookings: z.number().int().describe('Bookings checking in during the period'),
    averageStay: z.number().nullable().describe('Average nights of those bookings'),
  })
  .meta({ id: 'ReportFigures' })

export const brokersQuerySchema = checkedPeriod(period.extend({ propertyId: z.uuid().optional() }))

export const brokersReportSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    brokers: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        bookings: z.number().int(),
        nights: z.number().int(),
        lodging: cents,
        averageCommissionBps: z.number().int(),
        fees: cents.describe('Whole fees of the bookings checking in during the period'),
        items: z.array(
          z.object({
            bookingId: z.uuid(),
            guestName: z.string(),
            propertyName: z.string(),
            checkIn: z.iso.date(),
            checkOut: z.iso.date(),
            nights: z.number().int(),
            lodging: cents,
            commissionBps: z.number().int(),
            fee: cents,
          }),
        ),
      }),
    ),
    channels: z.array(
      z.object({
        brokerId: z.uuid().nullable().describe('Null for direct bookings'),
        name: z.string().nullable(),
        bookings: z.number().int(),
        nights: z.number().int(),
        revenue: cents,
        brokerFees: cents,
        net: cents,
        shareBps: z.number().int().describe("Share of the period's revenue"),
      }),
    ),
  })
  .meta({ id: 'BrokersReport' })

export const monthlyQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  /** Only this property; all of them without it. */
  propertyId: z.uuid().optional(),
})

export const monthlySchema = z
  .object({
    year: z.number().int(),
    months: z.array(figuresSchema.extend({ month: z.string().describe('`YYYY-MM`') })),
    total: figuresSchema,
  })
  .meta({ id: 'MonthlyReport' })

export const performanceSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    days: z.number().int(),
    properties: z.array(figuresSchema.extend({ id: z.uuid(), name: z.string() })),
    total: figuresSchema,
  })
  .meta({ id: 'PerformanceReport' })
