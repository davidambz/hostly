import { z } from 'zod'

import { nightsBetween, parseDate } from '../../shared/dates.js'

/** The longest period a report covers: two years and a leap day. */
export const MAX_REPORT_DAYS = 731

export const periodQuerySchema = z
  .object({
    /** First day, `YYYY-MM-DD`. */
    from: z.iso.date(),
    /** Day after the last one, `YYYY-MM-DD` (exclusive). */
    to: z.iso.date(),
  })
  .refine(({ from, to }) => from < to, { path: ['to'], message: 'Must be after from' })
  .refine(({ from, to }) => nightsBetween(parseDate(from), parseDate(to)) <= MAX_REPORT_DAYS, {
    path: ['to'],
    message: `At most ${String(MAX_REPORT_DAYS)} days`,
  })

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

export const performanceSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    days: z.number().int(),
    properties: z.array(figuresSchema.extend({ id: z.uuid(), name: z.string() })),
    total: figuresSchema,
  })
  .meta({ id: 'PerformanceReport' })
