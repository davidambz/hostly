import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let admin: User

const DAY_MS = 86_400_000

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  admin = await createUser(db, { name: 'Zeca Admin' })
  await db.user.update({ where: { id: admin.id }, data: { isAdmin: true } })
})

afterEach(async () => {
  await app.close()
})

const get = (as: User = admin) =>
  app.inject({ method: 'GET', url: '/admin/dashboard', headers: authHeader(app, as.id) })

async function grant(user: User, endsAt: Date | null, revokedAt: Date | null = null) {
  const premium = await db.plan.findUniqueOrThrow({ where: { code: 'premium' } })
  return db.planGrant.create({
    data: {
      userId: user.id,
      planId: premium.id,
      duration: endsAt ? 'ONE_MONTH' : 'LIFETIME',
      startsAt: new Date(Date.now() - DAY_MS),
      endsAt,
      revokedAt,
      reason: 'x',
    },
  })
}

describe('GET /admin/dashboard', () => {
  it('is only for administrators', async () => {
    const user = await createUser(db)

    expect((await app.inject({ method: 'GET', url: '/admin/dashboard' })).statusCode).toBe(401)
    expect((await get(user)).statusCode).toBe(403)
  })

  it('counts the accounts, their plans and where they come from', async () => {
    const ana = await createUser(db, { name: 'Ana' })
    const bia = await createUser(db, { name: 'Bia' })
    const old = await createUser(db, { name: 'Antiga' })
    await db.user.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 90 * DAY_MS) },
    })
    await grant(ana, null)
    await grant(bia, new Date(Date.now() + 10 * DAY_MS))
    // Revoked: Free again.
    await grant(old, null, new Date())

    const body = (await get()).json<Record<string, unknown>>()

    expect(body).toMatchObject({
      users: { total: 4, new: 3 },
      bySource: { free: 2, grant: 2 },
      byPlan: [
        { code: 'free', users: 2 },
        { code: 'premium', users: 2 },
      ],
    })
  })

  it('lists the grants ending in the next 30 days, soonest first', async () => {
    const ana = await createUser(db, { name: 'Ana', email: 'ana@hostly.test' })
    const bia = await createUser(db, { name: 'Bia' })
    const cid = await createUser(db, { name: 'Cid' })
    const inTwenty = new Date(Date.now() + 20 * DAY_MS)
    await grant(ana, inTwenty)
    await grant(bia, new Date(Date.now() + 5 * DAY_MS))
    // Later than 30 days, and for life: not ending soon.
    await grant(cid, new Date(Date.now() + 60 * DAY_MS))

    const body = (await get()).json<{
      grantsEndingSoon: { user: { name: string; email: string }; endsAt: string }[]
    }>()

    expect(body.grantsEndingSoon.map((item) => item.user.name)).toEqual(['Bia', 'Ana'])
    expect(body.grantsEndingSoon[1]).toMatchObject({
      user: { email: 'ana@hostly.test' },
      plan: { name: 'Premium' },
      endsAt: inTwenty.toISOString(),
    })
  })

  it('counts the properties and bookings of everyone', async () => {
    const ana = await createUser(db)
    const property = await createProperty(db, { userId: ana.id })
    await createProperty(db, { userId: admin.id })
    await createBooking(db, { userId: ana.id, propertyId: property.id })

    expect((await get()).json()).toMatchObject({ usage: { properties: 2, bookings: 1 } })
  })
})
