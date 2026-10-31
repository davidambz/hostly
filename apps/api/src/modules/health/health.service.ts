import type { HealthRepository } from './health.repository.js'
import type { ComponentStatus, Readiness } from './health.schemas.js'

/** Upper bound for the readiness check, so a hanging database can't hang the probe. */
export const DATABASE_CHECK_TIMEOUT_MS = 2000

export class HealthService {
  constructor(
    private readonly repository: Pick<HealthRepository, 'ping'>,
    private readonly timeoutMs = DATABASE_CHECK_TIMEOUT_MS,
  ) {}

  async readiness(): Promise<Readiness> {
    const database = await this.checkDatabase()
    return {
      status: database === 'up' ? 'ready' : 'unavailable',
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
      await Promise.race([this.repository.ping(), timeout])
      return 'up'
    } catch {
      return 'down'
    } finally {
      clearTimeout(timer)
    }
  }
}
