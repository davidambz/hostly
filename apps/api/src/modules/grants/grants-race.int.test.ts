import { setTimeout as sleep } from 'node:timers/promises'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
/** A change made with this reason holds its transaction open for a moment. */
const SLOW = 'devagar'
let app: App
let admin: User
let ana: User
let premium: string

beforeAll(async () => {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION test_slow_grant_event() RETURNS trigger AS $$
    BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END $$ LANGUAGE plpgsql`)
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE TRIGGER test_slow_grant_event AFTER INSERT ON plan_grant_events
    FOR EACH ROW WHEN (NEW.reason = '${SLOW}') EXECUTE FUNCTION test_slow_grant_event()`)
})

afterAll(async () => {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_slow_grant_event ON plan_grant_events')
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_slow_grant_event')
})

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  admin = await createUser(db)
  await db.user.update({ where: { id: admin.id }, data: { isAdmin: true } })
  ana = await createUser(db)
  premium = (await db.plan.findUniqueOrThrow({ where: { code: 'premium' } })).id
})

afterEach(async () => {
  await app.close()
})

const post = (url: string, payload: object) =>
  app.inject({ method: 'POST', url, payload, headers: authHeader(app, admin.id) })

async function grantMonth() {
  const response = await post(`/admin/users/${ana.id}/grants`, {
    planId: premium,
    duration: 'ONE_MONTH',
    reason: 'Parceiro',
  })
  return response.json<{ id: string; endsAt: string }>()
}

/** Runs `first` slowly and, while it is still open, `second`. */
async function overlap<T>(first: () => Promise<T>, second: () => Promise<T>) {
  const running = first()
  await sleep(100)
  return Promise.all([running, second()])
}

describe('grant changes at the same time', () => {
  it('adds both renewals', async () => {
    const granted = await grantMonth()
    const renew = (reason: string) =>
      post(`/admin/grants/${granted.id}/renew`, { duration: 'ONE_MONTH', reason })

    await overlap(
      () => renew(SLOW),
      () => renew('Mais um'),
    )

    const { endsAt } = await db.planGrant.findUniqueOrThrow({ where: { id: granted.id } })
    const first = new Date(granted.endsAt)
    expect(endsAt).not.toBeNull()
    const end = endsAt ?? first
    expect(
      (end.getUTCFullYear() - first.getUTCFullYear()) * 12 +
        end.getUTCMonth() -
        first.getUTCMonth(),
    ).toBe(2)
    expect(await db.planGrantEvent.count({ where: { grantId: granted.id } })).toBe(3)
  })

  it('refuses a renewal of a grant being revoked', async () => {
    const granted = await grantMonth()

    const [revoked, renewed] = await overlap(
      () => post(`/admin/grants/${granted.id}/revoke`, { reason: SLOW }),
      () => post(`/admin/grants/${granted.id}/renew`, { duration: 'ONE_MONTH', reason: 'Mais' }),
    )

    expect(revoked.statusCode).toBe(200)
    expect(renewed.statusCode).toBe(409)
    expect(renewed.json()).toMatchObject({ code: 'GRANT_REVOKED' })
    expect(
      await db.planGrantEvent.count({ where: { grantId: granted.id, action: 'RENEWED' } }),
    ).toBe(0)
  })
})
