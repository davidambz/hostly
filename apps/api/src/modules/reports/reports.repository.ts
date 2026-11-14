import type { Database } from '../../shared/database.js'
import type { ReportBooking } from './performance.js'

export class ReportsRepository {
  constructor(private readonly db: Database) {}

  /** The user's properties, by name. */
  properties(userId: string): Promise<{ id: string; name: string }[]> {
    return this.db.property.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
  }

  /** The user's bookings with at least one night in `[from, to)`. */
  bookings(userId: string, from: Date, to: Date): Promise<ReportBooking[]> {
    return this.db.booking.findMany({
      where: { userId, checkIn: { lt: to }, checkOut: { gt: from } },
      select: {
        propertyId: true,
        brokerId: true,
        checkIn: true,
        checkOut: true,
        nightlyRate: true,
        cleaningFee: true,
        discount: true,
        brokerCommissionBps: true,
      },
    })
  }
}
