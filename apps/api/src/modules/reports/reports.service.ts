import { formatDate, parseDate } from '../../shared/dates.js'
import { NotFoundError } from '../../shared/errors.js'
import { brokersReport } from './brokers-report.js'
import { type Figures, type Performance, performance } from './performance.js'
import type { ReportsRepository } from './reports.repository.js'

export class ReportsService {
  constructor(private readonly reports: ReportsRepository) {}

  /** How each of the user's properties did from `from` to the day before `to`. */
  async performance(userId: string, from: string, to: string): Promise<Performance> {
    const start = parseDate(from)
    const end = parseDate(to)
    const [properties, bookings] = await Promise.all([
      this.reports.properties(userId),
      this.reports.bookings(userId, start, end),
    ])
    return performance(properties, bookings, start, end)
  }

  /**
   * Each month of `year`, and the whole year, for one property or all of them. 404
   * PROPERTY_NOT_FOUND for a property that isn't the user's.
   */
  async monthly(userId: string, year: number, propertyId?: string): Promise<Monthly> {
    const all = await this.reports.properties(userId)
    const properties = propertyId ? all.filter((property) => property.id === propertyId) : all
    if (propertyId && properties.length === 0) {
      throw new NotFoundError('Property not found', {
        code: 'PROPERTY_NOT_FOUND',
        details: { field: 'propertyId' },
      })
    }
    const start = new Date(Date.UTC(year, 0, 1))
    const end = new Date(Date.UTC(year + 1, 0, 1))
    const bookings = await this.reports.bookings(userId, start, end)
    const months = Array.from({ length: 12 }, (_, index) => {
      const from = new Date(Date.UTC(year, index, 1))
      const to = new Date(Date.UTC(year, index + 1, 1))
      return {
        month: formatDate(from).slice(0, 7),
        ...performance(properties, bookings, from, to).total,
      }
    })
    return { year, months, total: performance(properties, bookings, start, end).total }
  }

  /** Commissions per broker and the channels' mix, for one property or all of them. */
  async brokers(userId: string, from: string, to: string, propertyId?: string) {
    if (propertyId) {
      const owned = await this.reports.properties(userId)
      if (!owned.some((property) => property.id === propertyId)) {
        throw new NotFoundError('Property not found', {
          code: 'PROPERTY_NOT_FOUND',
          details: { field: 'propertyId' },
        })
      }
    }
    const start = parseDate(from)
    const end = parseDate(to)
    return brokersReport(
      await this.reports.brokerBookings(userId, start, end, propertyId),
      start,
      end,
    )
  }
}

export interface Monthly {
  year: number
  months: ({ month: string } & Figures)[]
  total: Figures
}
