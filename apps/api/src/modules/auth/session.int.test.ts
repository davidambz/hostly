import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { testEnv } from '../../test/env.js'
import { createUser, TEST_PASSWORD } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'
import { REFRESH_COOKIE } from './auth.routes.js'
import { ROTATION_GRACE_MS } from './auth.service.js'
import { RefreshTokensRepository } from './refresh-tokens.repository.js'

const db = testDatabase()
let app: App
let user: User

interface Cookie {
  name: string
  value: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
  expires?: Date
}

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  user = await createUser(db, { email: 'ana@hostly.test' })
})

afterEach(async () => {
  await app.close()
})

function refreshCookie(response: { cookies: Cookie[] }) {
  return response.cookies.find((cookie) => cookie.name === REFRESH_COOKIE)
}

function login(email = 'ana@hostly.test', password = TEST_PASSWORD, remoteAddress?: string) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
    remoteAddress,
  })
}

async function loggedIn() {
  const response = await login()
  const cookie = refreshCookie(response)
  if (!cookie) throw new Error('login did not set the refresh cookie')
  return {
    accessToken: response.json<{ accessToken: string }>().accessToken,
    refresh: cookie.value,
  }
}

function refresh(token?: string) {
  return app.inject({
    method: 'POST',
    url: '/auth/refresh',
    cookies: token === undefined ? {} : { [REFRESH_COOKIE]: token },
  })
}

/** Moves every rotation of the user past the grace period, as if it happened long ago. */
async function ageRotations() {
  await db.refreshToken.updateMany({
    where: { revokedReason: 'ROTATED' },
    data: { revokedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1000) },
  })
}

function me(accessToken?: string) {
  return app.inject({
    method: 'GET',
    url: '/me',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  })
}

describe('POST /auth/login', () => {
  it('answers 200 with an access token and the user', async () => {
    const response = await login()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      accessToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/) as string,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: expect.objectContaining({ id: user.id, email: 'ana@hostly.test' }) as object,
    })
    expect(response.body).not.toContain('passwordHash')
  })

  it('sets the refresh token in a locked-down cookie scoped to /auth', async () => {
    const before = Date.now()

    const cookie = refreshCookie(await login())

    expect(cookie).toMatchObject({
      value: expect.stringMatching(/^[\w-]{43}$/) as string,
      path: '/auth',
      httpOnly: true,
      sameSite: 'Strict',
    })
    expect(cookie?.secure).toBeFalsy()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    expect(cookie?.expires?.getTime()).toBeGreaterThanOrEqual(before + thirtyDays - 1000)
  })

  it('marks the cookie Secure when COOKIE_SECURE is on', async () => {
    await app.close()
    app = await buildApp(testEnv({ COOKIE_SECURE: 'true' }), { db })

    expect(refreshCookie(await login())?.secure).toBe(true)
  })

  it('stores only the hash of the refresh token, in a new family per login', async () => {
    const first = refreshCookie(await login())
    const second = refreshCookie(await login())

    const stored = await db.refreshToken.findMany({ where: { userId: user.id } })
    expect(stored).toHaveLength(2)
    expect(stored.map((token) => token.tokenHash)).not.toContain(first?.value)
    expect(new Set(stored.map((token) => token.familyId)).size).toBe(2)
    expect(first?.value).not.toBe(second?.value)
  })

  it('takes the e-mail in any case and with spaces', async () => {
    expect((await login('  ANA@Hostly.test ')).statusCode).toBe(200)
  })

  it('answers 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const response = await login('ana@hostly.test', 'wrong password')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid e-mail or password',
    })
    expect(refreshCookie(response)).toBeUndefined()
  })

  it('answers exactly the same for an unknown e-mail', async () => {
    const wrongPassword = await login('ana@hostly.test', 'wrong password')
    const unknownEmail = await login('nobody@hostly.test', 'wrong password')

    expect(unknownEmail.statusCode).toBe(wrongPassword.statusCode)
    expect(unknownEmail.json()).toEqual(wrongPassword.json())
  })

  it.each([
    ['an invalid e-mail', { email: 'nope', password: 'x' }],
    ['an empty password', { email: 'ana@hostly.test', password: '' }],
    ['no body', {}],
  ])('answers 400 for %s', async (_case, payload) => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('is rate limited per client like signup', async () => {
    await app.close()
    app = await buildApp(testEnv({ AUTH_RATE_LIMIT_MAX: '2' }), { db })

    const statuses = []
    for (let i = 0; i < 3; i++) {
      statuses.push((await login('ana@hostly.test', 'guess', '10.0.0.1')).statusCode)
    }

    expect(statuses).toEqual([401, 401, 429])
    expect((await login(undefined, undefined, '10.0.0.2')).statusCode).toBe(200)
  })
})

describe('refresh token cleanup', () => {
  it("deletes the user's expired tokens on login, and nobody else's", async () => {
    await loggedIn()
    const other = await createUser(db, { email: 'other@hostly.test' })
    await login('other@hostly.test')
    await db.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

    await login()

    const left = await db.refreshToken.findMany({ select: { userId: true, expiresAt: true } })
    expect(left.filter((t) => t.userId === user.id)).toHaveLength(1)
    expect(left.filter((t) => t.userId === other.id)).toHaveLength(1)
  })
})

describe('RefreshTokensRepository.replace', () => {
  it('rolls the rotation back when storing the successor fails', async () => {
    await loggedIn()
    const repository = new RefreshTokensRepository(db)
    const [current] = await db.refreshToken.findMany()
    if (!current) throw new Error('no token')

    // Reusing the current hash makes the insert fail on the unique constraint.
    const replacing = repository.replace(
      current.id,
      {
        userId: user.id,
        familyId: current.familyId,
        tokenHash: current.tokenHash,
        expiresAt: current.expiresAt,
      },
      new Date(),
    )

    await expect(replacing).rejects.toThrow('refresh_tokens_token_hash_key')
    const after = await db.refreshToken.findUniqueOrThrow({ where: { id: current.id } })
    expect(after.revokedAt).toBeNull()
  })
})

describe('GET /me', () => {
  it('answers the logged-in user', async () => {
    const { accessToken } = await loggedIn()

    const response = await me(accessToken)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: user.id, email: 'ana@hostly.test' })
    expect(response.body).not.toContain('passwordHash')
  })

  it('answers 401 without a token', async () => {
    const response = await me()

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('answers 401 when the account was deleted after the token was issued', async () => {
    const { accessToken } = await loggedIn()
    await db.user.delete({ where: { id: user.id } })

    const response = await me(accessToken)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('answers 401 TOKEN_EXPIRED once the access token expires', async () => {
    await app.close()
    app = await buildApp(testEnv({ ACCESS_TOKEN_TTL_SECONDS: '1' }), { db })
    const { accessToken } = await loggedIn()
    await new Promise((resolve) => setTimeout(resolve, 1100))

    const response = await me(accessToken)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'TOKEN_EXPIRED' })
  })
})

describe('POST /auth/refresh', () => {
  it('trades the refresh cookie for a new access token and a new refresh cookie', async () => {
    const { refresh: token } = await loggedIn()

    const response = await refresh(token)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      accessToken: expect.any(String) as string,
      tokenType: 'Bearer',
      expiresIn: 900,
    })
    const rotated = refreshCookie(response)
    expect(rotated?.value).toMatch(/^[\w-]{43}$/)
    expect(rotated?.value).not.toBe(token)
    expect((await me(response.json<{ accessToken: string }>().accessToken)).statusCode).toBe(200)
  })

  it('keeps rotating: each new token works once', async () => {
    let { refresh: token } = await loggedIn()

    for (let i = 0; i < 3; i++) {
      const response = await refresh(token)
      expect(response.statusCode).toBe(200)
      token = refreshCookie(response)?.value ?? ''
    }

    const family = await db.refreshToken.findMany({ where: { userId: user.id } })
    expect(family).toHaveLength(4)
    expect(family.filter((t) => t.revokedAt === null)).toHaveLength(1)
  })

  it('treats a reused token as stolen: 401 REFRESH_TOKEN_REUSED and the session is gone', async () => {
    const { refresh: original } = await loggedIn()
    const rotated = refreshCookie(await refresh(original))?.value
    await ageRotations()

    const reuse = await refresh(original)

    expect(reuse.statusCode).toBe(401)
    expect(reuse.json()).toMatchObject({ code: 'REFRESH_TOKEN_REUSED' })
    // The legitimate holder's newer token was revoked with the family.
    const newer = await refresh(rotated)
    expect(newer.statusCode).toBe(401)
    expect(newer.json()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' })
    const reasons = await db.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { revokedReason: true },
    })
    expect(reasons.map((t) => t.revokedReason)).toEqual(['ROTATED', 'REUSE_DETECTED'])
  })

  it('leaves other sessions of the same user alone when one is revoked', async () => {
    const phone = await loggedIn()
    const laptop = await loggedIn()
    await refresh(phone.refresh)
    await ageRotations()
    await refresh(phone.refresh)

    expect((await refresh(laptop.refresh)).statusCode).toBe(200)
  })

  it('answers 401 REFRESH_TOKEN_EXPIRED for an expired token', async () => {
    const { refresh: token } = await loggedIn()
    await db.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

    const response = await refresh(token)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'REFRESH_TOKEN_EXPIRED' })
  })

  it.each([
    ['without the cookie', undefined],
    ['with an unknown token', 'unknown-token'],
  ])('answers 401 INVALID_REFRESH_TOKEN %s', async (_case, token) => {
    const response = await refresh(token)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' })
  })

  it('clears the cookie on a 401', async () => {
    const cleared = refreshCookie(await refresh('unknown-token'))

    expect(cleared).toMatchObject({ value: '', path: '/auth' })
    expect(cleared?.expires?.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('lets exactly one of two simultaneous refreshes through; the other may retry', async () => {
    const { refresh: token } = await loggedIn()

    const responses = await Promise.all([refresh(token), refresh(token)])

    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 401])
    const loser = responses.find((r) => r.statusCode === 401)
    expect(loser?.json()).toMatchObject({ code: 'REFRESH_TOKEN_ROTATED' })
    // The loser must not clear the cookie the winner just set.
    expect(refreshCookie(loser ?? { cookies: [] })).toBeUndefined()
    // Not treated as theft: the winner's new token keeps working.
    const winner = responses.find((r) => r.statusCode === 200)
    expect((await refresh(refreshCookie(winner ?? { cookies: [] })?.value)).statusCode).toBe(200)
  })

  it('treats a second tab refreshing with the just-rotated cookie as a retry, not theft', async () => {
    const { refresh: token } = await loggedIn()
    const first = refreshCookie(await refresh(token))?.value

    const second = await refresh(token)

    expect(second.statusCode).toBe(401)
    expect(second.json()).toMatchObject({ code: 'REFRESH_TOKEN_ROTATED' })
    expect((await refresh(first)).statusCode).toBe(200)
  })

  it("never extends the session: every rotated cookie keeps the login's expiry", async () => {
    const loginResponse = await login()
    const loginExpiry = refreshCookie(loginResponse)?.expires?.getTime()

    const rotated = refreshCookie(await refresh(refreshCookie(loginResponse)?.value))

    expect(rotated?.expires?.getTime()).toBe(loginExpiry)
    const stored = await db.refreshToken.findMany({ select: { expiresAt: true } })
    expect(new Set(stored.map((t) => t.expiresAt.getTime())).size).toBe(1)
  })

  it('is rate limited per client with the auth limit', async () => {
    await app.close()
    app = await buildApp(testEnv({ AUTH_RATE_LIMIT_MAX: '2' }), { db })

    const statuses = []
    for (let i = 0; i < 3; i++) {
      statuses.push((await refresh('guess')).statusCode)
    }

    expect(statuses).toEqual([401, 401, 429])
  })

  it('stops working once the user is deleted', async () => {
    const { refresh: token } = await loggedIn()
    await db.user.delete({ where: { id: user.id } })

    expect((await refresh(token)).statusCode).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const { refresh: token } = await loggedIn()

    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [REFRESH_COOKIE]: token },
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expect(refreshCookie(response)).toMatchObject({ value: '' })
    // A logged-out token is just invalid; it is not mistaken for a stolen one.
    const after = await refresh(token)
    expect(after.statusCode).toBe(401)
    expect(after.json()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' })
    const stored = await db.refreshToken.findFirstOrThrow({ where: { userId: user.id } })
    expect(stored.revokedReason).toBe('LOGOUT')
  })

  it('also revokes the tokens rotated from the same login', async () => {
    const { refresh: original } = await loggedIn()
    const rotated = refreshCookie(await refresh(original))?.value ?? ''

    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [REFRESH_COOKIE]: rotated },
    })

    expect((await refresh(rotated)).statusCode).toBe(401)
  })

  it.each([
    ['without a cookie', {}],
    ['with an unknown token', { [REFRESH_COOKIE]: 'unknown' }],
  ])('answers 204 %s', async (_case, cookies) => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout', cookies })

    expect(response.statusCode).toBe(204)
  })
})

it('documents the auth routes and the bearer scheme', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/json' })

  const spec = response.json<{
    paths: Record<string, Record<string, { security?: unknown }>>
    components: { securitySchemes: Record<string, unknown> }
  }>()
  expect(Object.keys(spec.paths)).toEqual(
    expect.arrayContaining(['/auth/login', '/auth/refresh', '/auth/logout', '/me']),
  )
  expect(spec.paths['/me']?.get?.security).toEqual([{ bearerAuth: [] }])
  expect(spec.components.securitySchemes).toHaveProperty('bearerAuth')
})
