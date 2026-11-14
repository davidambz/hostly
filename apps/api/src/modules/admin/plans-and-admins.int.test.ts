import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'
import { setAdmin } from './grant-admin.js'

const db = testDatabase()
let app: App

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
})

afterEach(async () => {
  await app.close()
})

describe('plans', () => {
  it('come with Free (one property, no price) and Premium (unlimited)', async () => {
    const plans = await db.plan.findMany({ orderBy: { code: 'asc' } })

    expect(plans.map((plan) => [plan.code, plan.name, plan.maxProperties, plan.active])).toEqual([
      ['free', 'Free', 1, true],
      ['premium', 'Premium', null, true],
    ])
  })

  it.each([
    ['no property at all', { maxProperties: 0 }],
    ['a negative price', { monthlyPrice: -1 }],
  ])('refuse, in the database, %s', async (_case, data) => {
    await expect(db.plan.update({ where: { code: 'premium' }, data })).rejects.toThrow()
  })

  it.each([
    ['turned off', { active: false }],
    ['given a price', { monthlyPrice: 1990 }],
  ])('keep Free free and on: it cannot be %s', async (_case, data) => {
    await expect(db.plan.update({ where: { code: 'free' }, data })).rejects.toThrow()
  })
})

describe('administrators', () => {
  it('are named by e-mail, any case, and can be undone', async () => {
    const user = await createUser(db, { name: 'Ana Souza', email: 'ana@hostly.test' })

    expect(await setAdmin(db, ' Ana@Hostly.TEST ', true)).toBe('Ana Souza')
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).isAdmin).toBe(true)

    await setAdmin(db, 'ana@hostly.test', false)
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).isAdmin).toBe(false)
  })

  it('say when there is no such account', async () => {
    expect(await setAdmin(db, 'ninguem@hostly.test', true)).toBeNull()
  })

  it('show up in /me, and nobody is one by default', async () => {
    const user = await createUser(db)
    const me = () => app.inject({ method: 'GET', url: '/me', headers: authHeader(app, user.id) })

    expect((await me()).json()).toMatchObject({ isAdmin: false })
    await db.user.update({ where: { id: user.id }, data: { isAdmin: true } })
    expect((await me()).json()).toMatchObject({ isAdmin: true })
  })
})
