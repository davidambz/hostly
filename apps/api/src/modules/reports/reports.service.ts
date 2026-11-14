import { parseDate } from '../../shared/dates.js'
import { type Performance, performance } from './performance.js'
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
}
