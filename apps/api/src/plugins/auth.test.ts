import { createHmac } from 'node:crypto'

import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import auth from './auth.js'
import errorHandler from './error-handler.js'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'
let app: FastifyInstance

beforeEach(async () => {
  app = Fastify()
  await app.register(errorHandler)
  await app.register(auth, { jwtSecret: SECRET, accessTokenTtlSeconds: 900 })
  app.get('/protected', { onRequest: [app.authenticate] }, (request) => ({
    userId: request.user.sub,
  }))
})

afterEach(async () => {
  await app.close()
})

function get(authorization?: string) {
  return app.inject({
    method: 'GET',
    url: '/protected',
    headers: authorization === undefined ? {} : { authorization },
  })
}

/** A hand-made JWT, to test tokens the plugin itself would never sign. */
function forge(header: object, payload: object, secret = SECRET) {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url')
  const unsigned = `${encode(header)}.${encode(payload)}`
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

describe('authenticate', () => {
  it('lets a valid access token through and exposes the user id', async () => {
    const response = await get(`Bearer ${app.jwt.sign({ sub: 'u1' })}`)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'u1' })
  })

  it('signs tokens with HS256 and the configured lifetime', () => {
    const token = app.jwt.sign({ sub: 'u1' })
    const decoded = app.jwt.decode<{ sub: string; iat: number; exp: number }>(token, {
      complete: true,
    }) as unknown as { header: { alg: string }; payload: { iat: number; exp: number } }

    expect(decoded.header.alg).toBe('HS256')
    expect(decoded.payload.exp - decoded.payload.iat).toBe(900)
  })

  it.each([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['Bearer without a token', 'Bearer'],
  ])('answers 401 UNAUTHORIZED with %s', async (_case, header) => {
    const response = await get(header)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Missing access token',
    })
  })

  it('answers 401 TOKEN_EXPIRED for an expired token, so the client knows to refresh', async () => {
    const token = forge(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'u1', iat: nowSeconds() - 1000, exp: nowSeconds() - 100 },
    )

    const response = await get(`Bearer ${token}`)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'TOKEN_EXPIRED' })
  })

  it.each<[string, () => string]>([
    ['garbage', () => 'not-a-jwt'],
    [
      'a token signed with another secret',
      () => forge({ alg: 'HS256' }, { sub: 'u1' }, 'x'.repeat(40)),
    ],
    [
      'a token with alg "none"',
      () =>
        `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"u1"}').toString('base64url')}.`,
    ],
    ['a token with another algorithm', () => forge({ alg: 'HS512' }, { sub: 'u1' })],
    [
      'a tampered payload',
      () => {
        const [header, , signature] = app.jwt.sign({ sub: 'u1' }).split('.')
        const payload = Buffer.from('{"sub":"admin"}').toString('base64url')
        return `${header ?? ''}.${payload}.${signature ?? ''}`
      },
    ],
  ])('answers 401 INVALID_TOKEN for %s', async (_case, token) => {
    const response = await get(`Bearer ${token()}`)

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({
      code: 'INVALID_TOKEN',
      message: 'Invalid access token',
    })
  })
})
