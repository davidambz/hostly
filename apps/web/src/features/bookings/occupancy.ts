import {
  addMonths,
  differenceInCalendarDays,
  getDaysInMonth,
  max,
  min,
  startOfMonth,
} from 'date-fns'

import { parseDate, toISODate } from './dates'

interface Stay {
  checkIn: string
  checkOut: string
  property: { id: string }
}

/** The first day of the month of `date`, and the first day of the next one (exclusive end). */
export function monthBounds(date: string): { from: string; to: string } {
  const start = startOfMonth(parseDate(date))
  return { from: toISODate(start), to: toISODate(addMonths(start, 1)) }
}

/**
 * How many nights of the month of `date` each property has booked. A stay counts only its
 * nights inside the month, so one that crosses the turn of the month is split between both.
 */
export function monthOccupancy(
  date: string,
  stays: Stay[],
): { nights: Map<string, number>; days: number } {
  const { from, to } = monthBounds(date)
  const start = parseDate(from)
  const end = parseDate(to)
  const nights = new Map<string, number>()
  for (const stay of stays) {
    const inside = differenceInCalendarDays(
      min([parseDate(stay.checkOut), end]),
      max([parseDate(stay.checkIn), start]),
    )
    if (inside <= 0) continue
    nights.set(stay.property.id, (nights.get(stay.property.id) ?? 0) + inside)
  }
  return { nights, days: getDaysInMonth(start) }
}

/** Depth steps, shallow to deep. */
export type Depth = 1 | 2 | 3 | 4 | 5 | 6

/**
 * The depth tint for a share of booked nights: an empty month is the shallowest water, a
 * month with every night taken the deepest.
 */
export function depthOf(nights: number, days: number): Depth {
  if (nights <= 0 || days <= 0) return 1
  const share = nights / days
  if (share <= 0.2) return 2
  if (share <= 0.4) return 3
  if (share <= 0.6) return 4
  if (share < 1) return 5
  return 6
}
