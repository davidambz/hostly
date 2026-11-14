import type { Booking } from './api'
import { addDaysISO } from './dates'

/** Every night taken in a property, and by whom: `YYYY-MM-DD` of the night → guest. */
export type OccupiedNights = Map<string, string>

/**
 * The nights the bookings take, the one being edited aside (it doesn't block itself). A
 * stay takes its check-in night up to the night before check-out: check-out day stays free
 * for the next guest.
 */
export function occupiedNights(bookings: Booking[], exceptBookingId?: string): OccupiedNights {
  const nights: OccupiedNights = new Map()
  for (const booking of bookings) {
    if (booking.id === exceptBookingId) continue
    for (let night = booking.checkIn; night < booking.checkOut; night = addDaysISO(night, 1)) {
      nights.set(night, booking.guestName)
    }
  }
  return nights
}

/** The first night of `[checkIn, checkOut)` already taken, if any. */
export function firstConflict(
  nights: OccupiedNights,
  checkIn: string,
  checkOut: string,
): { night: string; guest: string } | undefined {
  for (let night = checkIn; night < checkOut; night = addDaysISO(night, 1)) {
    const guest = nights.get(night)
    if (guest !== undefined) return { night, guest }
  }
  return undefined
}
