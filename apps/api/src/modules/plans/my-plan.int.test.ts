import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
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

const get = (url: string) => app.inject({ method: 'GET', url, headers: authHeader(app, user.id) })

describe('GET /plans', () => {
  it('lists the plans on sale for a logged-in user, Free first', async () => {
    await db.plan.create({ data: { name: 'Antigo', active: false } })
    await db.plan.update({ where: { code: 'premium' }, data: { monthlyPrice: 3990 } })

    const response = await get('/plans')

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      expect.objectContaining({ code: 'free', maxProperties: 1, monthlyPrice: null }),
      expect.objectContaining({ code: 'premium', maxProperties: null, monthlyPrice: 3990 }),
    ])
  })

  it('answers 401 without a token', async () => {
    expect((await app.inject({ method: 'GET', url: '/plans' })).statusCode).toBe(401)
  })
})

describe('GET /me/grants', () => {
  it("lists the account's courtesy plans, newest first, without the backoffice's notes", async () => {
    const premium = await db.plan.findUniqueOrThrow({ where: { code: 'premium' } })
    const other = await createUser(db)
    await db.planGrant.create({
      data: {
        userId: user.id,
        planId: premium.id,
        duration: 'ONE_MONTH',
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-02-01T00:00:00.000Z'),
        reason: 'nota interna',
        grantedById: other.id,
      },
    })
    await db.planGrant.create({
      data: {
        userId: user.id,
        planId: premium.id,
        duration: 'LIFETIME',
        startsAt: new Date(Date.now() - 1000),
        reason: 'outra nota',
      },
    })
    await db.planGrant.create({
      data: {
        userId: other.id,
        planId: premium.id,
        duration: 'LIFETIME',
        startsAt: new Date(),
        reason: 'x',
      },
    })

    const response = await get('/me/grants')

    expect(response.statusCode).toBe(200)
    const grants = response.json<{ duration: string; inForce: boolean }[]>()
    expect(grants.map((grant) => [grant.duration, grant.inForce])).toEqual([
      ['LIFETIME', true],
      ['ONE_MONTH', false],
    ])
    expect(grants[1]).toMatchObject({
      plan: { name: 'Premium' },
      endsAt: '2026-02-01T00:00:00.000Z',
    })
    expect(JSON.stringify(grants)).not.toMatch(/nota|reason|grantedBy/)
  })

  it('answers 401 without a token', async () => {
    expect((await app.inject({ method: 'GET', url: '/me/grants' })).statusCode).toBe(401)
  })
})
