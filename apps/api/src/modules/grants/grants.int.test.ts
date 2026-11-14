import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let admin: User
let ana: User
let premium: string

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  admin = await createUser(db, { name: 'Zeca Admin' })
  await db.user.update({ where: { id: admin.id }, data: { isAdmin: true } })
  ana = await createUser(db, { name: 'Ana Souza' })
  premium = (await db.plan.findUniqueOrThrow({ where: { code: 'premium' } })).id
})

afterEach(async () => {
  await app.close()
})

type Method = 'GET' | 'POST' | 'PATCH'

function request(method: Method, url: string, payload?: object, as: User = admin) {
  return app.inject({ method, url, payload, headers: authHeader(app, as.id) })
}

const grant = (payload: object, userId = ana.id) =>
  request('POST', `/admin/users/${userId}/grants`, payload)

async function grantPremium(duration = 'ONE_MONTH') {
  const response = await grant({ planId: premium, duration, reason: 'Cliente antigo' })
  return response.json<{ id: string; endsAt: string | null }>()
}

const planOfAna = async () =>
  (await request('GET', '/admin/users?search=Ana')).json<{
    items: { plan: { code: string }; planSource: string; grant: { id: string } | null }[]
  }>().items[0]

describe('plan grants', () => {
  it.each([
    ['GET', '/admin/users/018f0000-0000-7000-8000-000000000001/grants'],
    ['POST', '/admin/users/018f0000-0000-7000-8000-000000000001/grants'],
    ['POST', '/admin/grants/018f0000-0000-7000-8000-000000000001/renew'],
    ['PATCH', '/admin/grants/018f0000-0000-7000-8000-000000000001/plan'],
    ['POST', '/admin/grants/018f0000-0000-7000-8000-000000000001/revoke'],
  ] as const)('%s %s is only for administrators', async (method, url) => {
    expect((await app.inject({ method, url })).statusCode).toBe(401)
    expect((await request(method, url, { reason: 'x' }, ana)).statusCode).toBe(403)
  })

  it('gives a user Premium for a month, recorded with who, when and why', async () => {
    const before = Date.now()

    const response = await grant({ planId: premium, duration: 'ONE_MONTH', reason: ' Parceiro ' })

    expect(response.statusCode).toBe(201)
    const created = response.json<{
      endsAt: string
      startsAt: string
      events: { action: string; actor: { name: string }; reason: string }[]
    }>()
    expect(created).toMatchObject({
      plan: { code: 'premium', name: 'Premium' },
      duration: 'ONE_MONTH',
      reason: 'Parceiro',
      revokedAt: null,
      inForce: true,
      grantedBy: { id: admin.id, name: 'Zeca Admin' },
    })
    expect(Date.parse(created.startsAt)).toBeGreaterThanOrEqual(before)
    const days = (Date.parse(created.endsAt) - Date.parse(created.startsAt)) / 86_400_000
    expect(days).toBeGreaterThanOrEqual(28)
    expect(days).toBeLessThanOrEqual(31)
    expect(created.events).toEqual([
      expect.objectContaining({
        action: 'GRANTED',
        reason: 'Parceiro',
        actor: { id: admin.id, name: 'Zeca Admin' },
      }),
    ])
    expect(await planOfAna()).toMatchObject({ plan: { code: 'premium' }, planSource: 'GRANT' })
  })

  it('gives a plan for life', async () => {
    const created = await grantPremium('LIFETIME')

    expect(created.endsAt).toBeNull()
  })

  it('answers 409 ACTIVE_GRANT_EXISTS while one is in force', async () => {
    await grantPremium()

    const response = await grant({ planId: premium, duration: 'ONE_YEAR', reason: 'De novo' })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'ACTIVE_GRANT_EXISTS' })
  })

  it('grants again once the last one is over', async () => {
    const old = await grantPremium()
    await db.planGrant.update({
      where: { id: old.id },
      data: {
        startsAt: new Date(Date.now() - 60 * 86_400_000),
        endsAt: new Date(Date.now() - 1000),
      },
    })

    expect((await planOfAna())?.planSource).toBe('FREE')
    expect(
      (await grant({ planId: premium, duration: 'ONE_MONTH', reason: 'Volta' })).statusCode,
    ).toBe(201)
  })

  it.each([
    ['Free', 'free', 'CANNOT_GRANT_FREE'],
    ['a plan off sale', 'premium', 'PLAN_INACTIVE'],
  ])('refuses to grant %s', async (_case, code, error) => {
    const plan = await db.plan.findUniqueOrThrow({ where: { code } })
    if (code === 'premium')
      await db.plan.update({ where: { id: plan.id }, data: { active: false } })

    const response = await grant({ planId: plan.id, duration: 'ONE_MONTH', reason: 'x' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: error, details: { field: 'planId' } })
  })

  it.each([
    ['no reason', { duration: 'ONE_MONTH', reason: ' ' }],
    ['an unknown duration', { duration: 'TWO_WEEKS', reason: 'x' }],
  ])('answers 400 for %s', async (_case, payload) => {
    expect((await grant({ planId: premium, ...payload })).statusCode).toBe(400)
  })

  it('answers 404 for a user or a plan that is not there', async () => {
    const noUser = await grant(
      { planId: premium, duration: 'ONE_MONTH', reason: 'x' },
      '018f0000-0000-7000-8000-000000000009',
    )
    const noPlan = await grant({
      planId: '018f0000-0000-7000-8000-000000000009',
      duration: 'ONE_MONTH',
      reason: 'x',
    })

    expect(noUser.json()).toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(noPlan.json()).toMatchObject({ code: 'PLAN_NOT_FOUND' })
  })

  it('renews from where the grant ends', async () => {
    const created = await grantPremium('ONE_MONTH')

    const response = await request('POST', `/admin/grants/${created.id}/renew`, {
      duration: 'ONE_YEAR',
      reason: 'Renovou',
    })

    expect(response.statusCode).toBe(200)
    const renewed = response.json<{ endsAt: string; events: { action: string }[] }>()
    const extra = (Date.parse(renewed.endsAt) - Date.parse(created.endsAt ?? '')) / 86_400_000
    expect(extra).toBeGreaterThanOrEqual(365)
    expect(extra).toBeLessThanOrEqual(366)
    expect(renewed.events.map((item) => item.action)).toEqual(['GRANTED', 'RENEWED'])
  })

  it("changes a grant's plan, keeping its dates", async () => {
    const created = await grantPremium()
    const pro = await db.plan.create({ data: { name: 'Pro 5', maxProperties: 5 } })

    const response = await request('PATCH', `/admin/grants/${created.id}/plan`, {
      planId: pro.id,
      reason: 'Trocou',
    })

    expect(response.json()).toMatchObject({
      plan: { name: 'Pro 5' },
      endsAt: created.endsAt,
      events: [{ action: 'GRANTED' }, { action: 'PLAN_CHANGED', plan: { name: 'Pro 5' } }],
    })
  })

  it('revokes a grant: the user is back on Free, and it can not be touched again', async () => {
    const created = await grantPremium()

    const revoked = await request('POST', `/admin/grants/${created.id}/revoke`, { reason: 'Fim' })
    const again = await request('POST', `/admin/grants/${created.id}/revoke`, { reason: 'Fim' })
    const renew = await request('POST', `/admin/grants/${created.id}/renew`, {
      duration: 'ONE_MONTH',
      reason: 'x',
    })

    expect(revoked.json()).toMatchObject({
      inForce: false,
      revokedAt: expect.any(String) as string,
    })
    expect(again.json()).toMatchObject({ code: 'GRANT_REVOKED' })
    expect(renew.statusCode).toBe(409)
    expect(await planOfAna()).toMatchObject({
      plan: { code: 'free' },
      planSource: 'FREE',
      grant: null,
    })
  })

  it('answers 404 GRANT_NOT_FOUND for a grant that is not there', async () => {
    const response = await request(
      'POST',
      '/admin/grants/018f0000-0000-7000-8000-000000000009/revoke',
      { reason: 'x' },
    )

    expect(response.json()).toMatchObject({ code: 'GRANT_NOT_FOUND' })
  })

  it('lists the grants of a user, newest first', async () => {
    const first = await grantPremium()
    await request('POST', `/admin/grants/${first.id}/revoke`, { reason: 'Fim' })
    await grantPremium('LIFETIME')

    const response = await request('GET', `/admin/users/${ana.id}/grants`)

    expect(response.json<{ duration: string }[]>().map((item) => item.duration)).toEqual([
      'LIFETIME',
      'ONE_MONTH',
    ])
  })

  it('refuses, in the database, two grants in force at once', async () => {
    await grantPremium('LIFETIME')

    await expect(
      db.planGrant.create({
        data: {
          userId: ana.id,
          planId: premium,
          duration: 'LIFETIME',
          startsAt: new Date(),
          reason: 'x',
        },
      }),
    ).rejects.toThrow()
  })
})
