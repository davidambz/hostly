import { nightsBetween } from '../../shared/dates.js'
import { computeFinancials } from '../bookings/booking-financials.js'

/** What a report needs of a booking. */
export interface ReportBooking {
  propertyId: string
  brokerId: string | null
  checkIn: Date
  checkOut: Date
  nightlyRate: number
  cleaningFee: number
  discount: number
  brokerCommissionBps: number
}

/** A booking's share of a period. Money in cents. */
export interface BookingSlice {
  /** Nights of the booking inside the period. */
  nights: number
  /** Its lodging for those nights. */
  lodging: number
  /** The broker's fee on that lodging. */
  brokerFee: number
  /** The cleaning fee, when the booking checks in inside the period. */
  cleaning: number
  /** Whether it checks in inside the period. */
  checksIn: boolean
  /** All its nights, inside the period or not. */
  stayNights: number
}

/**
 * The part of a booking that falls in `[from, to)`. Its lodging and broker fee are spread
 * over its nights: nights `[a, b)` of `n` get `⌊X·b/n⌋ − ⌊X·a/n⌋`, so the parts of any split
 * add up to the whole, to the cent. The cleaning fee belongs to the check-in day.
 */
export function sliceOf(booking: ReportBooking, from: Date, to: Date): BookingSlice {
  const stayNights = nightsBetween(booking.checkIn, booking.checkOut)
  const money = computeFinancials({
    nights: stayNights,
    nightlyRate: booking.nightlyRate,
    cleaningFee: booking.cleaningFee,
    discount: booking.discount,
    amountPaid: 0,
    brokerCommissionBps: booking.brokerId ? booking.brokerCommissionBps : 0,
  })
  const first = Math.min(stayNights, Math.max(0, nightsBetween(booking.checkIn, from)))
  const last = Math.max(first, Math.min(stayNights, nightsBetween(booking.checkIn, to)))
  const part = (amount: number) =>
    stayNights === 0
      ? 0
      : Math.floor((amount * last) / stayNights) - Math.floor((amount * first) / stayNights)
  const checksIn = booking.checkIn >= from && booking.checkIn < to
  return {
    nights: last - first,
    lodging: part(money.lodging),
    brokerFee: part(money.brokerFee),
    cleaning: checksIn ? booking.cleaningFee : 0,
    checksIn,
    stayNights,
  }
}

/** A period's figures, for one property or several. Money in cents. */
export interface Figures {
  /** Nights the period offers (days × properties). */
  nightsAvailable: number
  nightsSold: number
  /** Nights sold over nights available, in basis points (10 000 = 100%). */
  occupancyBps: number
  lodging: number
  cleaning: number
  /** Lodging + cleaning: what guests pay for the period. */
  revenue: number
  brokerFees: number
  /** Revenue − broker fees: what the owner keeps. */
  net: number
  /** Average daily rate: lodging over nights sold; null without any. */
  averageDailyRate: number | null
  /** Revenue per available night: lodging over nights available. */
  revpar: number
  /** Bookings checking in during the period. */
  bookings: number
  /** Average nights of those bookings; null without any. */
  averageStay: number | null
}

interface Totals {
  nightsAvailable: number
  nightsSold: number
  lodging: number
  cleaning: number
  brokerFees: number
  bookings: number
  stayNights: number
}

const empty = (nightsAvailable: number): Totals => ({
  nightsAvailable,
  nightsSold: 0,
  lodging: 0,
  cleaning: 0,
  brokerFees: 0,
  bookings: 0,
  stayNights: 0,
})

function add(totals: Totals, slice: BookingSlice) {
  totals.nightsSold += slice.nights
  totals.lodging += slice.lodging
  totals.cleaning += slice.cleaning
  totals.brokerFees += slice.brokerFee
  if (slice.checksIn) {
    totals.bookings += 1
    totals.stayNights += slice.stayNights
  }
}

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : Math.round(part / whole))

function figures(totals: Totals): Figures {
  const revenue = totals.lodging + totals.cleaning
  return {
    nightsAvailable: totals.nightsAvailable,
    nightsSold: totals.nightsSold,
    occupancyBps: ratio(totals.nightsSold * 10_000, totals.nightsAvailable),
    lodging: totals.lodging,
    cleaning: totals.cleaning,
    revenue,
    brokerFees: totals.brokerFees,
    net: revenue - totals.brokerFees,
    averageDailyRate: totals.nightsSold === 0 ? null : ratio(totals.lodging, totals.nightsSold),
    revpar: ratio(totals.lodging, totals.nightsAvailable),
    bookings: totals.bookings,
    averageStay:
      totals.bookings === 0 ? null : Math.round((totals.stayNights / totals.bookings) * 10) / 10,
  }
}

export interface Performance {
  days: number
  properties: ({ id: string; name: string } & Figures)[]
  total: Figures
}

/**
 * How each property did in `[from, to)`, and all of them together. Every property is
 * listed, with zeros when it had no booking; bookings may start before or end after the
 * period, and only their nights inside it count.
 */
export function performance(
  properties: { id: string; name: string }[],
  bookings: ReportBooking[],
  from: Date,
  to: Date,
): Performance {
  const days = nightsBetween(from, to)
  const byProperty = new Map(properties.map((property) => [property.id, empty(days)]))
  const total = empty(days * properties.length)
  for (const booking of bookings) {
    const totals = byProperty.get(booking.propertyId)
    if (!totals) continue
    const slice = sliceOf(booking, from, to)
    add(totals, slice)
    add(total, slice)
  }
  return {
    days,
    properties: properties.map((property) => ({
      id: property.id,
      name: property.name,
      ...figures(byProperty.get(property.id) ?? empty(days)),
    })),
    total: figures(total),
  }
}
