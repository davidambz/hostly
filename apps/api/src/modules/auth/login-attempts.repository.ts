import type { Database } from '../../shared/database.js'

export class LoginAttemptsRepository {
  constructor(private readonly db: Database) {}

  /**
   * Counts one more login attempt for `email` and answers how many it has in the window
   * (which restarts once it is older than `windowStartedAfter`). One statement, so
   * attempts made at the same moment are all counted.
   */
  async register(email: string, now: Date, windowStartedAfter: Date): Promise<number> {
    const [row] = await this.db.$queryRaw<{ attempts: number }[]>`
      INSERT INTO login_attempts (email, attempts, window_started_at)
      VALUES (${email}, 1, ${now})
      ON CONFLICT (email) DO UPDATE SET
        attempts = CASE WHEN login_attempts.window_started_at <= ${windowStartedAfter}
          THEN 1 ELSE login_attempts.attempts + 1 END,
        window_started_at = CASE WHEN login_attempts.window_started_at <= ${windowStartedAfter}
          THEN ${now} ELSE login_attempts.window_started_at END
      RETURNING attempts
    `
    // Windows that are over count for nothing; this keeps the table small.
    await this.db.loginAttempt.deleteMany({
      where: { windowStartedAt: { lte: windowStartedAfter } },
    })
    return row?.attempts ?? 1
  }

  /** A successful login starts the count over. */
  async clear(email: string): Promise<void> {
    await this.db.loginAttempt.deleteMany({ where: { email } })
  }
}
