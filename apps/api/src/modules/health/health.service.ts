import type { Database } from '../../shared/database.js'

export type ComponentStatus = 'up' | 'down'

export interface HealthReport {
  status: 'ok' | 'unavailable'
  checks: { database: ComponentStatus }
}

export const DATABASE_CHECK_TIMEOUT_MS = 2000

export class HealthService {
  constructor(
    private readonly db: Database,
    private readonly timeoutMs = DATABASE_CHECK_TIMEOUT_MS,
  ) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase()
    return {
      status: database === 'up' ? 'ok' : 'unavailable',
      checks: { database },
    }
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`database check timed out after ${this.timeoutMs}ms`))
      }, this.timeoutMs)
    })

    try {
      await Promise.race([this.db.$queryRaw`SELECT 1`, timeout])
      return 'up'
    } catch {
      return 'down'
    } finally {
      clearTimeout(timer)
    }
  }
}
