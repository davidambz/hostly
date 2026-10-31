/**
 * Date-only values (check-in/out). On the wire they are `YYYY-MM-DD`; in JS they are Dates
 * at UTC midnight, which is how Prisma reads and writes Postgres `date` columns.
 */

/** Where "today" is decided, e.g. for upcoming vs past bookings. */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'

const DAY_MS = 24 * 60 * 60 * 1000

export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Today's date (`YYYY-MM-DD`) in `timeZone`, which may differ from UTC's. */
export function today(timeZone = BUSINESS_TIME_ZONE, now = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
}

/** Nights between two date-only values: check-in on day 1, check-out on day 3 = 2 nights. */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}
