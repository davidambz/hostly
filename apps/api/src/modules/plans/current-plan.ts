import type { Plan } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { PAYING_STATUSES } from '../billing/paying-statuses.js'
import { FREE_PLAN } from './system-plans.js'

/** What a user's plan comes from. */
export type PlanSource = 'FREE' | 'GRANT' | 'SUBSCRIPTION'

/** The database, or a transaction on it: anything that can read plans and grants. */
export type PlanReader = Pick<Database, 'plan' | 'planGrant' | 'subscription'>

export interface CurrentPlan {
  plan: Plan
  source: PlanSource
  /** The grant behind it, if any. */
  grant: { id: string; endsAt: Date | null } | null
  /** The paid subscription behind it, if any. */
  subscription: {
    id: string
    period: 'MONTHLY' | 'SEMIANNUAL' | 'ANNUAL'
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
  } | null
}

/**
 * The plan each user is on now: a grant in force, otherwise a paid subscription that is
 * running (active; a failed payment, past_due, doesn't count), otherwise Free. The one
 * place that decides it.
 */
export async function currentPlans(
  db: PlanReader,
  userIds: string[],
  now = new Date(),
): Promise<Map<string, CurrentPlan>> {
  const [free, grants, subscriptions] = await Promise.all([
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
    db.subscription.findMany({
      where: { userId: { in: userIds }, status: { in: PAYING_STATUSES } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const byUser = new Map(grants.map((grant) => [grant.userId, grant]))
  const paidBy = new Map<string, (typeof subscriptions)[number]>()
  for (const subscription of subscriptions) {
    if (!paidBy.has(subscription.userId)) paidBy.set(subscription.userId, subscription)
  }
  return new Map(
    userIds.map((id) => {
      const grant = byUser.get(id)
      const paid = paidBy.get(id)
      const current: CurrentPlan = grant
        ? {
            plan: grant.plan,
            source: 'GRANT',
            grant: { id: grant.id, endsAt: grant.endsAt },
            subscription: null,
          }
        : paid
          ? {
              plan: paid.plan,
              source: 'SUBSCRIPTION',
              grant: null,
              subscription: {
                id: paid.id,
                period: paid.period,
                currentPeriodEnd: paid.currentPeriodEnd,
                cancelAtPeriodEnd: paid.cancelAtPeriodEnd,
              },
            }
          : { plan: free, source: 'FREE', grant: null, subscription: null }
      return [id, current]
    }),
  )
}

/** The plan one user is on now. */
export async function currentPlan(
  db: PlanReader,
  userId: string,
  now = new Date(),
): Promise<CurrentPlan> {
  const plan = (await currentPlans(db, [userId], now)).get(userId)
  if (!plan) throw new Error(`No plan for user ${userId}`)
  return plan
}
