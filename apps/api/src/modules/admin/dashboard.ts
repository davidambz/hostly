import { z } from 'zod'

import type { Database } from '../../shared/database.js'
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
    bySource: z.object({ free: z.number().int(), grant: z.number().int() }),
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
  const [total, recent, plans, grantsByPlan, ending, properties, bookings] = await Promise.all([
    db.user.count(),
    db.user.count({
      where: { createdAt: { gte: new Date(now.getTime() - DASHBOARD_WINDOW_DAYS * DAY_MS) } },
    }),
    db.plan.findMany({ orderBy: { name: 'asc' } }),
    db.planGrant.groupBy({ by: ['planId'], where: inForce, _count: { _all: true } }),
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
  const granted = new Map(grantsByPlan.map((row) => [row.planId, row._count._all]))
  const onGrant = grantsByPlan.reduce((sum, row) => sum + row._count._all, 0)
  const byPlan = plans
    .map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      // Everyone without a grant in force is on Free.
      users: plan.code === FREE_PLAN ? total - onGrant : (granted.get(plan.id) ?? 0),
    }))
    .sort((a, b) => Number(b.code === FREE_PLAN) - Number(a.code === FREE_PLAN))

  return {
    users: { total, new: recent },
    byPlan,
    bySource: { free: total - onGrant, grant: onGrant },
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
