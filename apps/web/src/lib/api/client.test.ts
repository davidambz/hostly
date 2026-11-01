import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, API_URL, refreshSession } from './client'
import { ApiError, unwrap } from './errors'
import { getAccessToken, onAccessTokenChange, setAccessToken } from './session'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})
afterEach(() => {
  server.resetHandlers()
  setAccessToken(null)
})
afterAll(() => {
  server.close()
})

const me = { id: 'u1', name: 'Ana', email: 'ana@hostly.dev', cpf: '1', phone: '1', createdAt: '' }
const expired = () =>
  HttpResponse.json({ statusCode: 401, code: 'TOKEN_EXPIRED', message: 'expired' }, { status: 401 })

/** /me that only accepts `token`, answering TOKEN_EXPIRED otherwise. */
function meAccepting(token: string) {
  return http.get(`${API_URL}/me`, ({ request }) =>
    request.headers.get('authorization') === `Bearer ${token}` ? HttpResponse.json(me) : expired(),
  )
}

function refreshGiving(token: string, calls = { count: 0 }) {
  return http.post(`${API_URL}/auth/refresh`, () => {
    calls.count++
    return HttpResponse.json({ accessToken: token, tokenType: 'Bearer', expiresIn: 900 })
  })
}

describe('api client', () => {
  beforeEach(() => {
    setAccessToken('old')
  })

  it('sends the access token', async () => {
    server.use(meAccepting('old'))

    expect(unwrap(await api.GET('/me'))).toEqual(me)
  })

  it('sends no Authorization header without a session', async () => {
    setAccessToken(null)
    let header: string | null = 'unset'
    server.use(
      http.get(`${API_URL}/me`, ({ request }) => {
        header = request.headers.get('authorization')
        return HttpResponse.json(me)
      }),
    )

    await api.GET('/me')

    expect(header).toBeNull()
  })

  it('refreshes an expired token once and replays the request', async () => {
    const calls = { count: 0 }
    server.use(meAccepting('new'), refreshGiving('new', calls))

    expect(unwrap(await api.GET('/me'))).toEqual(me)
    expect(calls.count).toBe(1)
    expect(getAccessToken()).toBe('new')
  })

  it('replays the request body on retry', async () => {
    let received: unknown
    server.use(
      refreshGiving('new'),
      http.post(`${API_URL}/properties`, async ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer new') return expired()
        received = await request.json()
        return HttpResponse.json({ id: 'p1' }, { status: 201 })
      }),
    )

    await api.POST('/properties', { body: { name: 'Casa', type: 'HOUSE' } })

    expect(received).toEqual({ name: 'Casa', type: 'HOUSE' })
  })

  it('shares one refresh between requests that expire together', async () => {
    const calls = { count: 0 }
    server.use(meAccepting('new'), refreshGiving('new', calls))

    const results = await Promise.all([api.GET('/me'), api.GET('/me'), api.GET('/me')])

    expect(results.every((r) => r.response.ok)).toBe(true)
    expect(calls.count).toBe(1)
  })

  it('retries the refresh once when another tab just rotated the cookie', async () => {
    let attempt = 0
    server.use(
      meAccepting('new'),
      http.post(`${API_URL}/auth/refresh`, () =>
        ++attempt === 1
          ? HttpResponse.json(
              { code: 'REFRESH_TOKEN_ROTATED', statusCode: 401, message: '' },
              { status: 401 },
            )
          : HttpResponse.json({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 }),
      ),
    )

    expect((await api.GET('/me')).response.ok).toBe(true)
    expect(attempt).toBe(2)
  })

  it('ends the session when the refresh fails, and returns the original 401', async () => {
    const listener = vi.fn()
    onAccessTokenChange(listener)
    server.use(
      meAccepting('never'),
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json(
          { code: 'REFRESH_TOKEN_EXPIRED', statusCode: 401, message: '' },
          { status: 401 },
        ),
      ),
    )

    const result = await api.GET('/me')

    expect(result.response.status).toBe(401)
    expect(getAccessToken()).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
  })

  it.each([
    ['another 401', { statusCode: 401, code: 'INVALID_TOKEN', message: '' }, 401],
    ['a 404', { statusCode: 404, code: 'PROPERTY_NOT_FOUND', message: '' }, 404],
  ])('does not refresh on %s', async (_case, body, status) => {
    const calls = { count: 0 }
    server.use(
      http.get(`${API_URL}/me`, () => HttpResponse.json(body, { status })),
      refreshGiving('new', calls),
    )

    expect((await api.GET('/me')).response.status).toBe(status)
    expect(calls.count).toBe(0)
  })

  it('does not refresh on a 401 without a JSON body', async () => {
    const calls = { count: 0 }
    server.use(
      http.get(`${API_URL}/me`, () => new HttpResponse('nope', { status: 401 })),
      refreshGiving('new', calls),
    )

    expect((await api.GET('/me')).response.status).toBe(401)
    expect(calls.count).toBe(0)
  })
})

describe('refreshSession', () => {
  it('sends the cookie and stores the new token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    server.use(refreshGiving('fresh'))

    await expect(refreshSession()).resolves.toBe('fresh')
    expect(getAccessToken()).toBe('fresh')
    expect(fetchSpy).toHaveBeenCalledWith(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
  })
})

describe('unwrap', () => {
  it('throws an ApiError carrying the code and details', () => {
    const response = new Response(null, { status: 409 })

    expect(() =>
      unwrap({
        error: {
          statusCode: 409,
          code: 'EMAIL_TAKEN',
          message: 'taken',
          details: { field: 'email' },
        },
        response,
      }),
    ).toThrow(
      expect.objectContaining({ status: 409, code: 'EMAIL_TAKEN', message: 'taken' }) as Error,
    )
  })

  it('throws for a failed response without a body', () => {
    let error: unknown
    try {
      unwrap({ response: new Response(null, { status: 502 }) })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' })
  })
})
