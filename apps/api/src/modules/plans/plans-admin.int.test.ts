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
let user: User

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  admin = await createUser(db)
  await db.user.update({ where: { id: admin.id }, data: { isAdmin: true } })
  user = await createUser(db)
})

afterEach(async () => {
  await app.close()
})

type Method = 'GET' | 'POST' | 'PATCH'

function request(method: Method, url: string, payload?: object, as: User = admin) {
  return app.inject({ method, url, payload, headers: authHeader(app, as.id) })
}

const planId = async (code: string) => (await db.plan.findUniqueOrThrow({ where: { code } })).id

describe('plans in the backoffice', () => {
  it.each([
    ['GET', '/admin/plans'],
    ['POST', '/admin/plans'],
    ['PATCH', '/admin/plans/018f0000-0000-7000-8000-000000000001'],
  ] as const)('%s %s is only for administrators', async (method, url) => {
    expect((await app.inject({ method, url })).statusCode).toBe(401)
    expect((await request(method, url, { name: 'X' }, user)).statusCode).toBe(403)
  })

  it('lists Free first, then by name', async () => {
    await request('POST', '/admin/plans', { name: 'Anual Promo', maxProperties: 5 })

    const response = await request('GET', '/admin/plans')

    expect(response.statusCode).toBe(200)
    expect(response.json<{ name: string }[]>().map((plan) => plan.name)).toEqual([
      'Free',
      'Anual Promo',
      'Premium',
    ])
  })

  it('creates a plan with its limit and prices', async () => {
    const response = await request('POST', '/admin/plans', {
      name: ' Pro 5 ',
      description: 'Até cinco imóveis.',
      maxProperties: 5,
      monthlyPrice: 2990,
      annualPrice: 29900,
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      code: null,
      name: 'Pro 5',
      description: 'Até cinco imóveis.',
      active: true,
      maxProperties: 5,
      monthlyPrice: 2990,
      semiannualPrice: null,
      annualPrice: 29900,
    })
  })

  it('creates an unlimited plan when no limit is sent', async () => {
    const response = await request('POST', '/admin/plans', { name: 'Tudo' })

    expect(response.json()).toMatchObject({ maxProperties: null })
  })

  it.each([
    ['no name', { name: ' ' }],
    ['a limit of zero', { name: 'X', maxProperties: 0 }],
    ['a price in reais', { name: 'X', monthlyPrice: 29.9 }],
    ['a negative price', { name: 'X', annualPrice: -1 }],
  ])('answers 400 for %s', async (_case, payload) => {
    expect((await request('POST', '/admin/plans', payload)).statusCode).toBe(400)
  })

  it('prices Premium and takes a plan off sale and back', async () => {
    const premium = await planId('premium')

    const priced = await request('PATCH', `/admin/plans/${premium}`, {
      monthlyPrice: 3990,
      semiannualPrice: 21540,
      annualPrice: 38300,
    })
    const off = await request('PATCH', `/admin/plans/${premium}`, { active: false })
    const on = await request('PATCH', `/admin/plans/${premium}`, { active: true })

    expect(priced.json()).toMatchObject({
      monthlyPrice: 3990,
      semiannualPrice: 21540,
      annualPrice: 38300,
    })
    expect(off.json()).toMatchObject({ active: false })
    expect(on.json()).toMatchObject({ active: true })
  })

  it('lets the Free plan change its text and limit', async () => {
    const response = await request('PATCH', `/admin/plans/${await planId('free')}`, {
      description: 'Um imóvel.',
      maxProperties: 2,
    })

    expect(response.json()).toMatchObject({ description: 'Um imóvel.', maxProperties: 2 })
  })

  it.each([
    ['a price', { monthlyPrice: 990 }, 'monthlyPrice'],
    ['turning it off', { active: false }, 'active'],
  ])('answers 400 FREE_PLAN_IS_FREE for %s on Free', async (_case, payload, field) => {
    const response = await request('PATCH', `/admin/plans/${await planId('free')}`, payload)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'FREE_PLAN_IS_FREE', details: { field } })
  })

  it('answers 404 PLAN_NOT_FOUND for a plan that is not there', async () => {
    const response = await request('PATCH', '/admin/plans/018f0000-0000-7000-8000-000000000009', {
      name: 'X',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'PLAN_NOT_FOUND' })
  })

  it('answers 400 for an empty change', async () => {
    expect((await request('PATCH', `/admin/plans/${await planId('premium')}`, {})).statusCode).toBe(
      400,
    )
  })
})
