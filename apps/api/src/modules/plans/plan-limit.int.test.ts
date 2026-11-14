import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let user: User

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  user = await createUser(db)
})

afterEach(async () => {
  await app.close()
})

const house = { name: 'Casa', type: 'HOUSE' }

function create(as: User = user) {
  return app.inject({
    method: 'POST',
    url: '/properties',
    payload: house,
    headers: authHeader(app, as.id),
  })
}

function myPlan() {
  return app.inject({ method: 'GET', url: '/me/plan', headers: authHeader(app, user.id) })
}

async function givePremium(endsAt: Date | null = null) {
  const premium = await db.plan.findUniqueOrThrow({ where: { code: 'premium' } })
  return db.planGrant.create({
    data: {
      userId: user.id,
      planId: premium.id,
      duration: endsAt ? 'ONE_MONTH' : 'LIFETIME',
      startsAt: new Date(Date.now() - 1000),
      endsAt,
      reason: 'teste',
    },
  })
}

describe('property limit of the plan', () => {
  it('lets a Free account have one property, and answers 409 PLAN_LIMIT_REACHED after it', async () => {
    expect((await create()).statusCode).toBe(201)

    const second = await create()

    expect(second.statusCode).toBe(409)
    expect(second.json()).toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      details: { limit: 1, count: 1, plan: 'Free' },
    })
    expect(await db.property.count({ where: { userId: user.id } })).toBe(1)
  })

  it('lets a granted Premium add as many as it wants', async () => {
    await givePremium()

    for (let i = 0; i < 3; i++) expect((await create()).statusCode).toBe(201)
  })

  it('keeps every property when the grant ends, but adds no more until back under the limit', async () => {
    const grant = await givePremium(new Date(Date.now() + 86_400_000))
    await create()
    await create()
    await db.planGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } })

    expect((await create()).statusCode).toBe(409)
    expect(await db.property.count({ where: { userId: user.id } })).toBe(2)
  })

  it('follows a limit changed in the backoffice', async () => {
    await db.plan.update({ where: { code: 'free' }, data: { maxProperties: 2 } })

    expect((await create()).statusCode).toBe(201)
    expect((await create()).statusCode).toBe(201)
    expect((await create()).statusCode).toBe(409)
  })

  it('never lets two creations at once pass the limit', async () => {
    const responses = await Promise.all([create(), create(), create()])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409])
    expect(await db.property.count({ where: { userId: user.id } })).toBe(1)
  })

  it("counts only the user's own properties", async () => {
    const other = await createUser(db)
    await createProperty(db, { userId: other.id })

    expect((await create()).statusCode).toBe(201)
  })
})

describe('GET /me/plan', () => {
  it('says the plan, where it comes from, and what is used', async () => {
    await createProperty(db, { userId: user.id })

    expect((await myPlan()).json()).toEqual({
      plan: {
        id: expect.any(String) as string,
        code: 'free',
        name: 'Free',
        description: expect.any(String) as string,
        maxProperties: 1,
      },
      source: 'FREE',
      endsAt: null,
      subscription: null,
      propertyCount: 1,
      canAddProperty: false,
    })
  })

  it('shows a granted plan with its end', async () => {
    const endsAt = new Date(Date.now() + 86_400_000)
    await givePremium(endsAt)

    expect((await myPlan()).json()).toMatchObject({
      plan: { code: 'premium', maxProperties: null },
      source: 'GRANT',
      endsAt: endsAt.toISOString(),
      canAddProperty: true,
    })
  })

  it('answers 401 without a token', async () => {
    expect((await app.inject({ method: 'GET', url: '/me/plan' })).statusCode).toBe(401)
  })
})
