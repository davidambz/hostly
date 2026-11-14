import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let admin: User
let ana: User

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  admin = await createUser(db, { name: 'Zeca Admin', email: 'zeca@hostly.test' })
  await db.user.update({ where: { id: admin.id }, data: { isAdmin: true } })
  ana = await createUser(db, { name: 'Ana Souza', email: 'ana@hostly.test' })
})

afterEach(async () => {
  await app.close()
})

type Method = 'GET' | 'PATCH'

function request(method: Method, url: string, payload?: object, as: User = admin) {
  return app.inject({ method, url, payload, headers: authHeader(app, as.id) })
}

describe('backoffice access', () => {
  it.each([
    ['GET', '/admin/users'],
    ['PATCH', `/admin/users/018f0000-0000-7000-8000-000000000001/admin`],
  ] as const)(
    '%s %s answers 401 without a token and 403 ADMIN_ONLY for a user',
    async (method, url) => {
      expect((await app.inject({ method, url })).statusCode).toBe(401)

      const response = await request(method, url, { isAdmin: true }, ana)

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ code: 'ADMIN_ONLY' })
    },
  )

  it('is checked on every request: a removed admin is out at once, token or not', async () => {
    await db.user.update({ where: { id: admin.id }, data: { isAdmin: false } })

    expect((await request('GET', '/admin/users')).statusCode).toBe(403)
  })
})

describe('GET /admin/users', () => {
  it('lists every account by name, with its properties and its plan', async () => {
    await createProperty(db, { userId: ana.id })
    await createProperty(db, { userId: ana.id })

    const response = await request('GET', '/admin/users')

    expect(response.statusCode).toBe(200)
    const page = response.json<{ items: Record<string, unknown>[]; total: number }>()
    expect(page.total).toBe(2)
    expect(page.items).toEqual([
      {
        id: ana.id,
        name: 'Ana Souza',
        email: 'ana@hostly.test',
        isAdmin: false,
        createdAt: expect.any(String) as string,
        propertyCount: 2,
        plan: { id: expect.any(String) as string, code: 'free', name: 'Free' },
        planSource: 'FREE',
        grant: null,
      },
      expect.objectContaining({ id: admin.id, isAdmin: true, propertyCount: 0 }),
    ])
    expect(JSON.stringify(page)).not.toContain('passwordHash')
  })

  it('searches part of the name or the e-mail, in any case, literally', async () => {
    const byName = await request('GET', '/admin/users?search=SOUZA')
    const byEmail = await request('GET', '/admin/users?search=zeca@')
    const pattern = await request('GET', '/admin/users?search=%25')

    expect(byName.json<{ items: { id: string }[] }>().items.map((u) => u.id)).toEqual([ana.id])
    expect(byEmail.json<{ items: { id: string }[] }>().items.map((u) => u.id)).toEqual([admin.id])
    expect(pattern.json<{ total: number }>().total).toBe(0)
  })

  it('paginates', async () => {
    const response = await request('GET', '/admin/users?page=2&pageSize=1')

    expect(response.json()).toMatchObject({ total: 2, page: 2, pageSize: 1 })
  })
})

describe('PATCH /admin/users/:id/admin', () => {
  it('grants and removes the administrator role', async () => {
    expect(
      (await request('PATCH', `/admin/users/${ana.id}/admin`, { isAdmin: true })).statusCode,
    ).toBe(204)
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).isAdmin).toBe(true)

    await request('PATCH', `/admin/users/${ana.id}/admin`, { isAdmin: false })
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).isAdmin).toBe(false)
  })

  it('answers 409 OWN_ADMIN_ROLE for your own account', async () => {
    const response = await request('PATCH', `/admin/users/${admin.id}/admin`, { isAdmin: false })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'OWN_ADMIN_ROLE' })
  })

  it('answers 404 USER_NOT_FOUND for an account that is not there', async () => {
    const response = await request(
      'PATCH',
      '/admin/users/018f0000-0000-7000-8000-000000000009/admin',
      { isAdmin: true },
    )

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('answers 400 without a boolean', async () => {
    const response = await request('PATCH', `/admin/users/${ana.id}/admin`, { isAdmin: 'yes' })

    expect(response.statusCode).toBe(400)
  })
})
