import { z } from 'zod'

import type { Database } from '../../shared/database.js'
import { currentPlans } from '../plans/current-plan.js'
import { FREE_PLAN } from '../plans/system-plans.js'

const DAY_MS = 24 * 60 * 60 * 1000
/** "New" accounts and grants "ending soon" look this many days back and ahead. */
export const DASHBOARD_WINDOW_DAYS = 30

export const dashboardSchema = z
  .object({
    users: z.object({
      total: z.number().int(),
      /** Signed up in the last 30 days. */
      new: z.number().int(),
    }),
    /** How many accounts each plan has now, Free first. */
    byPlan: z.array(
      z.object({
        id: z.uuid(),
        code: z.string().nullable(),
        name: z.string(),
        users: z.number().int(),
      }),
    ),
    /** Where the accounts' plans come from. */
    bySource: z.object({
      free: z.number().int(),
      grant: z.number().int(),
      subscription: z.number().int(),
    }),
    /** Grants in force that end in the next 30 days, soonest first. */
    grantsEndingSoon: z.array(
      z.object({
        grantId: z.uuid(),
        user: z.object({ id: z.uuid(), name: z.string(), email: z.string() }),
        plan: z.object({ name: z.string() }),
        endsAt: z.iso.datetime(),
      }),
    ),
    usage: z.object({ properties: z.number().int(), bookings: z.number().int() }),
  })
  .meta({ id: 'AdminDashboard' })

export type Dashboard = z.infer<typeof dashboardSchema>

/** The backoffice's figures, read from the whole database. */
export async function dashboard(db: Database, now = new Date()): Promise<Dashboard> {
  const inForce = {
    revokedAt: null,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  }
  const soon = new Date(now.getTime() + DASHBOARD_WINDOW_DAYS * DAY_MS)
  const [users, recent, plans, ending, properties, bookings] = await Promise.all([
    db.user.findMany({ select: { id: true } }),
    db.user.count({
      where: { createdAt: { gte: new Date(now.getTime() - DASHBOARD_WINDOW_DAYS * DAY_MS) } },
    }),
    db.plan.findMany({ orderBy: { name: 'asc' } }),
    db.planGrant.findMany({
      where: { ...inForce, endsAt: { gt: now, lte: soon } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { name: true } },
      },
      orderBy: { endsAt: 'asc' },
    }),
    db.property.count(),
    db.booking.count(),
  ])
  // The same resolution the rest of the API uses, so the figures never disagree with it.
  const current = [
    ...(
      await currentPlans(
        db,
        users.map((user) => user.id),
        now,
      )
    ).values(),
  ]
  const count = (match: (plan: (typeof current)[number]) => boolean) => current.filter(match).length
  const byPlan = plans
    .map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      users: count((item) => item.plan.id === plan.id),
    }))
    .sort((a, b) => Number(b.code === FREE_PLAN) - Number(a.code === FREE_PLAN))

  return {
    users: { total: users.length, new: recent },
    byPlan,
    bySource: {
      free: count((item) => item.source === 'FREE'),
      grant: count((item) => item.source === 'GRANT'),
      subscription: count((item) => item.source === 'SUBSCRIPTION'),
    },
    grantsEndingSoon: ending.map((grant) => ({
      grantId: grant.id,
      user: grant.user,
      plan: grant.plan,
      // Filtered on endsAt > now above: never null here.
      endsAt: (grant.endsAt ?? now).toISOString(),
    })),
    usage: { properties, bookings },
  }
}
