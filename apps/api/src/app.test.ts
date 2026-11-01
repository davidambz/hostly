import { afterEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from './app.js'
import { testEnv } from './test/env.js'
import { fakeDatabase } from './test/fake-database.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let app: App | undefined

async function start(overrides: Parameters<typeof testEnv>[0] = {}) {
  app = await buildApp(testEnv(overrides), { db: fakeDatabase() })
  return app
}

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /health', () => {
  it('is never rate limited', async () => {
    const api = await start({ RATE_LIMIT_MAX: '1' })

    const statuses = await Promise.all(
      Array.from({ length: 5 }, () => api.inject({ method: 'GET', url: '/health' })),
    ).then((responses) => responses.map((response) => response.statusCode))

    expect(statuses).toEqual([200, 200, 200, 200, 200])
  })
})

describe('buildApp', () => {
  it('boots with the pretty logger used in development', async () => {
    const api = await start({ NODE_ENV: 'development', LOG_LEVEL: 'silent' })

    const response = await api.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
  })
})

describe('request id', () => {
  it('generates a UUID and returns it in x-request-id', async () => {
    const api = await start()

    const first = await api.inject({ method: 'GET', url: '/health' })
    const second = await api.inject({ method: 'GET', url: '/health' })

    expect(first.headers['x-request-id']).toMatch(UUID)
    expect(second.headers['x-request-id']).toMatch(UUID)
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id'])
  })

  it('reuses a safe incoming x-request-id', async () => {
    const api = await start()

    const response = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'proxy-abc_123' },
    })

    expect(response.headers['x-request-id']).toBe('proxy-abc_123')
  })

  it.each([
    ['with characters that could forge log lines', 'abc\ninjected'],
    ['with spaces', 'two words'],
    ['longer than 128 characters', 'a'.repeat(129)],
    ['empty', ''],
  ])('replaces an incoming x-request-id %s', async (_case, incoming) => {
    const api = await start()

    const response = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': incoming },
    })

    expect(response.headers['x-request-id']).toMatch(UUID)
  })

  it('is also returned on error responses', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/does-not-exist' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['x-request-id']).toMatch(UUID)
  })
})

describe('trailing slash', () => {
  it('treats a route with and without a trailing slash as the same', async () => {
    const api = await start()

    const [bare, slashed] = await Promise.all([
      api.inject({ method: 'GET', url: '/health' }),
      api.inject({ method: 'GET', url: '/health/' }),
    ])

    expect([bare.statusCode, slashed.statusCode]).toEqual([200, 200])
  })
})

describe('unknown routes', () => {
  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)(
    'answers 404 for %s on an unknown route',
    async (method) => {
      const api = await start()

      const response = await api.inject({ method, url: '/nope?x=1' })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        statusCode: 404,
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${method} /nope?x=1 not found`,
      })
    },
  )

  it('counts against the rate limit, so the API cannot be scanned for free', async () => {
    const api = await start({ RATE_LIMIT_MAX: '2' })

    const statuses = []
    for (let i = 0; i < 3; i++) {
      statuses.push((await api.inject({ method: 'GET', url: `/scan-${i}` })).statusCode)
    }

    expect(statuses).toEqual([404, 404, 429])
  })

  it('checks the limit before reading the body, so malformed payloads count too', async () => {
    const api = await start({ RATE_LIMIT_MAX: '2' })

    const statuses = []
    for (let i = 0; i < 3; i++) {
      const response = await api.inject({
        method: 'POST',
        url: '/scan',
        headers: { 'content-type': 'application/json' },
        payload: '{"broken": ',
      })
      statuses.push(response.statusCode)
    }

    expect(statuses.at(-1)).toBe(429)
  })
})

describe('security headers', () => {
  it('sets the helmet headers', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/health' })

    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'strict-transport-security': expect.stringContaining('max-age=') as string,
      'content-security-policy': expect.stringContaining("default-src 'self'") as string,
    })
    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})

describe('CORS', () => {
  const allowed = 'http://localhost:5173'

  it('allows a configured origin, with credentials', async () => {
    const api = await start({ CORS_ORIGINS: `${allowed},https://hostly.app` })

    const response = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://hostly.app' },
    })

    expect(response.headers['access-control-allow-origin']).toBe('https://hostly.app')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(response.headers['access-control-expose-headers']).toBe('x-request-id')
  })

  it('does not allow an origin that is not configured', async () => {
    const api = await start({ CORS_ORIGINS: allowed })

    const response = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('answers the preflight of an allowed origin', async () => {
    const api = await start({ CORS_ORIGINS: allowed })

    const response = await api.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: allowed,
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(allowed)
    expect(response.headers['access-control-allow-methods']).toContain('PATCH')
    expect(response.headers['access-control-allow-headers']).toBe('authorization,content-type')
  })
})

describe('rate limit', () => {
  it('answers 429 in the standard error format after RATE_LIMIT_MAX requests', async () => {
    const api = await start({ RATE_LIMIT_MAX: '2' })
    api.get('/limited', () => ({ ok: true }))

    // Sequential on purpose: the in-memory store hands every request of the same
    // tick the same counter object, so parallel injects would all read the final count.
    const responses = []
    for (let i = 0; i < 3; i++) {
      responses.push(await api.inject({ method: 'GET', url: '/limited' }))
    }
    const limited = responses.at(-1)

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 429])
    expect(responses[0]?.headers['x-ratelimit-remaining']).toBe('1')
    expect(limited?.json()).toEqual({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: expect.stringMatching(/^Rate limit exceeded, retry in /) as string,
    })
    expect(limited?.headers['retry-after']).toBeDefined()
    expect(limited?.headers['x-ratelimit-limit']).toBe('2')
  })

  it('counts each client separately', async () => {
    const api = await start({ RATE_LIMIT_MAX: '1' })
    api.get('/limited', () => ({ ok: true }))

    const first = await api.inject({ method: 'GET', url: '/limited', remoteAddress: '10.0.0.1' })
    const second = await api.inject({ method: 'GET', url: '/limited', remoteAddress: '10.0.0.2' })
    const firstAgain = await api.inject({
      method: 'GET',
      url: '/limited',
      remoteAddress: '10.0.0.1',
    })

    expect([first.statusCode, second.statusCode, firstAgain.statusCode]).toEqual([200, 200, 429])
  })

  describe('behind a proxy', () => {
    async function hitThroughProxy(api: App, clientIp: string) {
      const response = await api.inject({
        method: 'GET',
        url: '/limited',
        remoteAddress: '10.0.0.254',
        headers: { 'x-forwarded-for': clientIp },
      })
      return response.statusCode
    }

    it('limits each client IP separately when TRUST_PROXY is on', async () => {
      const api = await start({ RATE_LIMIT_MAX: '1', TRUST_PROXY: 'true' })
      api.get('/limited', () => ({ ok: true }))

      const statuses = [
        await hitThroughProxy(api, '203.0.113.1'),
        await hitThroughProxy(api, '203.0.113.2'),
        await hitThroughProxy(api, '203.0.113.1'),
      ]

      expect(statuses).toEqual([200, 200, 429])
    })

    it('ignores x-forwarded-for when TRUST_PROXY is off, so it cannot be spoofed', async () => {
      const api = await start({ RATE_LIMIT_MAX: '1', TRUST_PROXY: 'false' })
      api.get('/limited', () => ({ ok: true }))

      const statuses = [
        await hitThroughProxy(api, '203.0.113.1'),
        await hitThroughProxy(api, '203.0.113.2'),
      ]

      expect(statuses).toEqual([200, 429])
    })
  })
})

describe('API docs', () => {
  it('serves the OpenAPI document with the registered routes', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/docs/json' })

    expect(response.statusCode).toBe(200)
    const document = response.json<{
      openapi: string
      info: { title: string }
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    }>()
    expect(document.openapi).toMatch(/^3\./)
    expect(document.info.title).toBe('Hostly API')
    expect(document.paths['/health']?.get?.responses['200']).toBeDefined()
  })

  it('does not list the docs routes themselves', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/docs/json' })

    const paths = Object.keys(response.json<{ paths: object }>().paths)
    expect(paths.filter((path) => path.startsWith('/docs'))).toEqual([])
  })

  it('is not exposed when DOCS_ENABLED is off', async () => {
    const api = await start({ DOCS_ENABLED: 'false' })

    const [json, ui] = await Promise.all([
      api.inject({ method: 'GET', url: '/docs/json' }),
      api.inject({ method: 'GET', url: '/docs/' }),
    ])

    expect(json.statusCode).toBe(404)
    expect(ui.statusCode).toBe(404)
  })

  it('serves the Swagger UI', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/docs/' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^text\/html/)
    expect(response.body).toContain('swagger-ui')
  })
})
