import type { Plan } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { FREE_PLAN } from './system-plans.js'

/** What a user's plan comes from. */
export type PlanSource = 'FREE' | 'GRANT'

export interface CurrentPlan {
  plan: Plan
  source: PlanSource
  /** The grant behind it, if any. */
  grant: { id: string; endsAt: Date | null } | null
}

/**
 * The plan each user is on now: a grant in force, otherwise Free. The one place that decides
 * it (paid subscriptions join here).
 */
export async function currentPlans(
  db: Database,
  userIds: string[],
  now = new Date(),
): Promise<Map<string, CurrentPlan>> {
  const [free, grants] = await Promise.all([
    db.plan.findUniqueOrThrow({ where: { code: FREE_PLAN } }),
    db.planGrant.findMany({
      where: {
        userId: { in: userIds },
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      include: { plan: true },
    }),
  ])
  const byUser = new Map(grants.map((grant) => [grant.userId, grant]))
  return new Map(
    userIds.map((id) => {
      const grant = byUser.get(id)
      return [
        id,
        grant
          ? {
              plan: grant.plan,
              source: 'GRANT' as const,
              grant: { id: grant.id, endsAt: grant.endsAt },
            }
          : { plan: free, source: 'FREE' as const, grant: null },
      ]
    }),
  )
}
