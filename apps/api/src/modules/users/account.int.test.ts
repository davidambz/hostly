import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser, TEST_PASSWORD } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'
import { REFRESH_COOKIE } from '../auth/auth.routes.js'

const db = testDatabase()
let app: App
let user: User

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  user = await createUser(db, { name: 'Ana Souza', email: 'ana@hostly.test' })
})

afterEach(async () => {
  await app.close()
})

/** Logs in like a device would: its access token and its refresh cookie. */
async function device(password = TEST_PASSWORD) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'ana@hostly.test', password },
  })
  const cookie = response.cookies.find((item) => item.name === REFRESH_COOKIE)
  if (!cookie) throw new Error('login did not set the refresh cookie')
  return {
    accessToken: response.json<{ accessToken: string }>().accessToken,
    refresh: cookie.value,
  }
}

function refresh(token: string) {
  return app.inject({
    method: 'POST',
    url: '/auth/refresh',
    cookies: { [REFRESH_COOKIE]: token },
  })
}

describe('PATCH /me', () => {
  function patch(payload: object, as: User = user) {
    return app.inject({ method: 'PATCH', url: '/me', payload, headers: authHeader(app, as.id) })
  }

  it('changes the name and the e-mail, lowercased', async () => {
    const response = await patch({ name: ' Ana Maria Souza ', email: 'Ana.Maria@Hostly.TEST' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      name: 'Ana Maria Souza',
      email: 'ana.maria@hostly.test',
    })
    expect(response.json()).not.toHaveProperty('passwordHash')
  })

  it('changes only what is sent', async () => {
    const response = await patch({ name: 'Ana Maria' })

    expect(response.json()).toMatchObject({ name: 'Ana Maria', email: 'ana@hostly.test' })
  })

  it('answers 409 EMAIL_TAKEN for the e-mail of another account', async () => {
    await createUser(db, { email: 'carlos@hostly.test' })

    const response = await patch({ email: 'Carlos@hostly.test' })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'EMAIL_TAKEN', details: { field: 'email' } })
  })

  it('keeps its own e-mail without a conflict', async () => {
    expect((await patch({ email: 'ana@hostly.test' })).statusCode).toBe(200)
  })

  it.each([
    ['an empty body', {}],
    ['a blank name', { name: '  ' }],
    ['an invalid e-mail', { email: 'ana@' }],
  ])('answers 400 for %s', async (_case, payload) => {
    expect((await patch(payload)).statusCode).toBe(400)
  })

  it('answers 401 without a token', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/me', payload: { name: 'X' } })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /auth/password', () => {
  function change(accessToken: string, refreshToken: string, payload: object) {
    return app.inject({
      method: 'POST',
      url: '/auth/password',
      payload,
      headers: { authorization: `Bearer ${accessToken}` },
      cookies: { [REFRESH_COOKIE]: refreshToken },
    })
  }

  it('changes the password and logs out the other devices, keeping this one', async () => {
    const phone = await device()
    const laptop = await device()

    const response = await change(laptop.accessToken, laptop.refresh, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'outra senha forte',
    })

    expect(response.statusCode).toBe(204)
    expect((await refresh(laptop.refresh)).statusCode).toBe(200)
    expect((await refresh(phone.refresh)).statusCode).toBe(401)
    // The old password no longer works; the new one does.
    await expect(device()).rejects.toThrow()
    await expect(device('outra senha forte')).resolves.toBeDefined()
  })

  it('answers 400 WRONG_PASSWORD on the current password, and changes nothing', async () => {
    const laptop = await device()

    const response = await change(laptop.accessToken, laptop.refresh, {
      currentPassword: 'not it',
      newPassword: 'outra senha forte',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      code: 'WRONG_PASSWORD',
      details: { field: 'currentPassword' },
    })
    await expect(device()).resolves.toBeDefined()
  })

  it('answers 400 for a new password that is too short', async () => {
    const laptop = await device()

    const response = await change(laptop.accessToken, laptop.refresh, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'curta',
    })

    expect(response.statusCode).toBe(400)
  })

  it('answers 401 without a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/password',
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'outra senha forte' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /auth/logout-others', () => {
  it('logs out every other device of the account, and only of this account', async () => {
    const phone = await device()
    const laptop = await device()
    const other = await createUser(db, { email: 'carlos@hostly.test' })
    const carlos = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'carlos@hostly.test', password: TEST_PASSWORD },
    })
    const carlosCookie = carlos.cookies.find((item) => item.name === REFRESH_COOKIE)?.value ?? ''

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout-others',
      headers: { authorization: `Bearer ${laptop.accessToken}` },
      cookies: { [REFRESH_COOKIE]: laptop.refresh },
    })

    expect(response.statusCode).toBe(204)
    expect((await refresh(laptop.refresh)).statusCode).toBe(200)
    expect((await refresh(phone.refresh)).statusCode).toBe(401)
    expect((await refresh(carlosCookie)).statusCode).toBe(200)
    expect(other.id).not.toBe(user.id)
  })

  it('answers 401 without a token', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout-others' })

    expect(response.statusCode).toBe(401)
  })
})
