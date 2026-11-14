import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import { testEnv } from '../../test/env.js'
import { createUser, TEST_PASSWORD } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from './auth.service.js'

const db = testDatabase()
let app: App
let ip = 0

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  await createUser(db, { email: 'ana@hostly.test' })
})

afterEach(async () => {
  await app.close()
})

/** Each attempt from a new IP address: the per-IP limit never gets in the way. */
function login(password: string, email = 'ana@hostly.test') {
  ip += 1
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
    remoteAddress: `10.0.${String(Math.floor(ip / 250))}.${String(ip % 250)}`,
  })
}

async function fail(times: number, email?: string) {
  for (let attempt = 0; attempt < times; attempt++) {
    expect((await login('senha errada', email)).statusCode).toBe(401)
  }
}

describe('login attempts per e-mail', () => {
  it('locks the e-mail after too many attempts from many addresses, even the right password', async () => {
    await fail(LOGIN_MAX_ATTEMPTS)

    const response = await login(TEST_PASSWORD)

    expect(response.statusCode).toBe(429)
    expect(response.json()).toMatchObject({
      code: 'LOGIN_LOCKED',
      details: { retryAfterSeconds: 900 },
    })
  })

  it('answers an unknown e-mail the same way, so the lock reveals no account', async () => {
    await fail(LOGIN_MAX_ATTEMPTS, 'ninguem@hostly.test')

    expect((await login('qualquer', 'ninguem@hostly.test')).json()).toMatchObject({
      code: 'LOGIN_LOCKED',
    })
  })

  it('counts every attempt made at the same moment', async () => {
    const responses = await Promise.all(
      Array.from({ length: LOGIN_MAX_ATTEMPTS * 2 }, () => login('senha errada')),
    )

    const codes = responses.map((response) => response.statusCode)
    expect(codes.filter((code) => code === 401)).toHaveLength(LOGIN_MAX_ATTEMPTS)
    expect(codes.filter((code) => code === 429)).toHaveLength(LOGIN_MAX_ATTEMPTS)
  })

  it('starts over after a successful login', async () => {
    await fail(LOGIN_MAX_ATTEMPTS - 1)
    expect((await login(TEST_PASSWORD)).statusCode).toBe(200)

    await fail(LOGIN_MAX_ATTEMPTS)
  })

  it('opens again once the window is over, and forgets old windows', async () => {
    await fail(LOGIN_MAX_ATTEMPTS)
    await db.loginAttempt.updateMany({
      data: { windowStartedAt: new Date(Date.now() - LOGIN_WINDOW_MS - 1000) },
    })

    expect((await login(TEST_PASSWORD)).statusCode).toBe(200)
    expect(await db.loginAttempt.count()).toBe(0)
  })

  it('keeps other e-mails apart', async () => {
    await fail(LOGIN_MAX_ATTEMPTS, 'outra@hostly.test')

    expect((await login(TEST_PASSWORD)).statusCode).toBe(200)
  })
})
