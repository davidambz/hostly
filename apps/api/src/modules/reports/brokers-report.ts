import { nightsBetween } from '../../shared/dates.js'
import { computeFinancials } from '../bookings/booking-financials.js'
import { type ReportBooking, sliceOf } from './performance.js'

/** A booking with what the commissions report shows of it. */
export interface BrokerBooking extends ReportBooking {
  id: string
  guestName: string
  propertyName: string
  brokerName: string | null
}

export interface Commission {
  bookingId: string
  guestName: string
  propertyName: string
  checkIn: Date
  checkOut: Date
  nights: number
  lodging: number
  commissionBps: number
  fee: number
}

export interface BrokerCommissions {
  id: string
  name: string
  bookings: number
  nights: number
  lodging: number
  /** The fees over the lodging, in basis points. */
  averageCommissionBps: number
  fees: number
  items: Commission[]
}

export interface Channel {
  /** Null for direct bookings, without a broker. */
  brokerId: string | null
  name: string | null
  bookings: number
  nights: number
  revenue: number
  brokerFees: number
  net: number
  /** This channel's share of the period's revenue, in basis points. */
  shareBps: number
}

export interface BrokersReport {
  brokers: BrokerCommissions[]
  channels: Channel[]
}

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : Math.round(part / whole))

/**
 * What to pay each broker and how each channel did in `[from, to)`.
 *
 * Commissions are settled per booking: the bookings checking in during the period, each with
 * its whole fee. Channels follow the performance report instead (nights inside the period,
 * lodging and fee spread per night, cleaning on the check-in day), so their totals match it.
 */
export function brokersReport(bookings: BrokerBooking[], from: Date, to: Date): BrokersReport {
  const brokers = new Map<string, BrokerCommissions>()
  const channels = new Map<string, Channel>()

  for (const booking of bookings) {
    if (booking.brokerId && booking.checkIn >= from && booking.checkIn < to) {
      const nights = nightsBetween(booking.checkIn, booking.checkOut)
      const money = computeFinancials({
        nights,
        nightlyRate: booking.nightlyRate,
        cleaningFee: booking.cleaningFee,
        discount: booking.discount,
        amountPaid: 0,
        brokerCommissionBps: booking.brokerCommissionBps,
      })
      const broker = brokers.get(booking.brokerId) ?? {
        id: booking.brokerId,
        name: booking.brokerName ?? '',
        bookings: 0,
        nights: 0,
        lodging: 0,
        averageCommissionBps: 0,
        fees: 0,
        items: [],
      }
      broker.bookings += 1
      broker.nights += nights
      broker.lodging += money.lodging
      broker.fees += money.brokerFee
      broker.items.push({
        bookingId: booking.id,
        guestName: booking.guestName,
        propertyName: booking.propertyName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        lodging: money.lodging,
        commissionBps: booking.brokerCommissionBps,
        fee: money.brokerFee,
      })
      brokers.set(booking.brokerId, broker)
    }

    const slice = sliceOf(booking, from, to)
    if (slice.nights === 0 && slice.cleaning === 0) continue
    const key = booking.brokerId ?? ''
    const channel = channels.get(key) ?? {
      brokerId: booking.brokerId,
      name: booking.brokerName,
      bookings: 0,
      nights: 0,
      revenue: 0,
      brokerFees: 0,
      net: 0,
      shareBps: 0,
    }
    if (slice.checksIn) channel.bookings += 1
    channel.nights += slice.nights
    channel.revenue += slice.lodging + slice.cleaning
    channel.brokerFees += slice.brokerFee
    channel.net = channel.revenue - channel.brokerFees
    channels.set(key, channel)
  }

  const revenue = [...channels.values()].reduce((sum, channel) => sum + channel.revenue, 0)
  return {
    brokers: [...brokers.values()]
      .map((broker) => ({
        ...broker,
        averageCommissionBps: ratio(broker.fees * 10_000, broker.lodging),
        items: broker.items.sort(
          (a, b) =>
            a.checkIn.getTime() - b.checkIn.getTime() || a.guestName.localeCompare(b.guestName),
        ),
      }))
      .sort((a, b) => b.fees - a.fees || a.name.localeCompare(b.name)),
    channels: [...channels.values()]
      .map((channel) => ({ ...channel, shareBps: ratio(channel.revenue * 10_000, revenue) }))
      .sort((a, b) => b.revenue - a.revenue || (a.name ?? '').localeCompare(b.name ?? '')),
  }
}
