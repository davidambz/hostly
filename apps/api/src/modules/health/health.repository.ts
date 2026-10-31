import type { Database } from '../../shared/database.js'

export class HealthRepository {
  constructor(private readonly db: Database) {}

  /** Resolves when the database answers a trivial query, rejects otherwise. */
  async ping(): Promise<void> {
    await this.db.$queryRaw`SELECT 1`
  }
}
