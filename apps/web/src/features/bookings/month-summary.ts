import { addDaysISO } from './dates'
import { monthBounds } from './occupancy'

interface Stay {
  checkIn: string
  checkOut: string
  amountPaid: number
  financials: { total: number; brokerFee: number; balanceDue: number }
}

/** The money of a month, from the bookings that check in during it. */
export interface MonthMoney {
  bookings: number
  /** What the guests pay. */
  total: number
  /** Already received. */
  paid: number
  /** Still to receive. */
  due: number
  /** What goes to the brokers. */
  fees: number
}

/**
 * Adds up the bookings that check in during the month of `date`. A stay belongs to the month
 * it starts in, whole, so a booking is counted once, the way the owner bills it.
 */
export function monthMoney(date: string, stays: Stay[]): MonthMoney {
  const { from, to } = monthBounds(date)
  const money: MonthMoney = { bookings: 0, total: 0, paid: 0, due: 0, fees: 0 }
  for (const stay of stays) {
    if (stay.checkIn < from || stay.checkIn >= to) continue
    money.bookings += 1
    money.total += stay.financials.total
    money.paid += stay.amountPaid
    money.due += stay.financials.balanceDue
    money.fees += stay.financials.brokerFee
  }
  return money
}

/** Arrivals and departures from `today` on, `days` days of them. */
export const UPCOMING_DAYS = 7

export interface Move<T> {
  date: string
  kind: 'arrival' | 'departure'
  stay: T
}

/**
 * Who arrives and who leaves from `today` through the next `days` days, by date, arrivals
 * of a day before its departures.
 */
export function upcomingMoves<T extends { checkIn: string; checkOut: string }>(
  today: string,
  stays: T[],
  days = UPCOMING_DAYS,
): Move<T>[] {
  const end = addDaysISO(today, days)
  const moves: Move<T>[] = []
  for (const stay of stays) {
    if (stay.checkIn >= today && stay.checkIn < end) {
      moves.push({ date: stay.checkIn, kind: 'arrival', stay })
    }
    if (stay.checkOut >= today && stay.checkOut < end) {
      moves.push({ date: stay.checkOut, kind: 'departure', stay })
    }
  }
  return moves.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'arrival' ? -1 : 1),
  )
}
