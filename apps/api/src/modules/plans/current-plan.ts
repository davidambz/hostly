import type { Plan } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { FREE_PLAN } from './system-plans.js'

/**
 * The plan each user is on now. Until grants and paid subscriptions exist, every account is
 * on Free; this is the one place that decides it, so they only need to change it here.
 */
export async function currentPlans(db: Database, userIds: string[]): Promise<Map<string, Plan>> {
  const free = await db.plan.findUniqueOrThrow({ where: { code: FREE_PLAN } })
  return new Map(userIds.map((id) => [id, free]))
}
