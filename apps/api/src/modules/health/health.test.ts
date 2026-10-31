import { afterEach, describe, expect, it, vi } from 'vitest'

import { type App, buildApp } from '../../app.js'
import { testEnv } from '../../test/env.js'
import { type FakeDatabase, fakeDatabase } from '../../test/fake-database.js'
import { HealthRepository } from './health.repository.js'
import { DATABASE_CHECK_TIMEOUT_MS, HealthService } from './health.service.js'

function fakeRepository() {
  return { ping: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) }
}

describe('HealthRepository', () => {
  it('pings the database with a trivial query', async () => {
    const db = fakeDatabase()

    await new HealthRepository(db).ping()

    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    const [strings] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray]
    expect(strings.join('?')).toBe('SELECT 1')
  })

  it('propagates a database failure', async () => {
    const db = fakeDatabase()
    db.$queryRaw.mockRejectedValue(new Error('connection refused'))

    await expect(new HealthRepository(db).ping()).rejects.toThrow('connection refused')
  })
})

describe('HealthService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is ready when the database answers', async () => {
    const repository = fakeRepository()

    await expect(new HealthService(repository).readiness()).resolves.toEqual({
      status: 'ready',
      checks: { database: 'up' },
    })
    expect(repository.ping).toHaveBeenCalledTimes(1)
  })

  it('is unavailable when the database fails', async () => {
    const repository = fakeRepository()
    repository.ping.mockRejectedValue(new Error('connection refused'))

    await expect(new HealthService(repository).readiness()).resolves.toEqual({
      status: 'unavailable',
      checks: { database: 'down' },
    })
  })

  it('is unavailable when the database hangs past the timeout', async () => {
    vi.useFakeTimers()
    const repository = fakeRepository()
    repository.ping.mockReturnValue(new Promise(() => undefined))

    const report = new HealthService(repository).readiness()
    await vi.advanceTimersByTimeAsync(DATABASE_CHECK_TIMEOUT_MS)

    await expect(report).resolves.toEqual({
      status: 'unavailable',
      checks: { database: 'down' },
    })
  })

  it('does not time out a database that answers just in time', async () => {
    vi.useFakeTimers()
    const repository = fakeRepository()
    repository.ping.mockReturnValue(
      new Promise((resolve) => setTimeout(resolve, DATABASE_CHECK_TIMEOUT_MS - 1)),
    )

    const report = new HealthService(repository).readiness()
    await vi.advanceTimersByTimeAsync(DATABASE_CHECK_TIMEOUT_MS - 1)

    await expect(report).resolves.toMatchObject({ status: 'ready' })
  })

  it('honors a custom timeout', async () => {
    vi.useFakeTimers()
    const repository = fakeRepository()
    repository.ping.mockReturnValue(new Promise(() => undefined))

    const report = new HealthService(repository, 50).readiness()
    await vi.advanceTimersByTimeAsync(50)

    await expect(report).resolves.toMatchObject({ status: 'unavailable' })
  })

  it('clears the timeout timer once the check is done', async () => {
    vi.useFakeTimers()

    await new HealthService(fakeRepository()).readiness()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('health routes', () => {
  let app: App | undefined
  let db: FakeDatabase

  async function start() {
    const fake = fakeDatabase()
    db = fake
    app = await buildApp(testEnv(), { db: fake })
    return app
  }

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  describe('GET /health', () => {
    it('answers 200 without touching the database', async () => {
      const api = await start()

      const response = await api.inject({ method: 'GET', url: '/health' })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toMatch(/^application\/json/)
      expect(response.json()).toEqual({ status: 'ok' })
      expect(db.$queryRaw).not.toHaveBeenCalled()
    })

    it('stays 200 while the database is down, so the container is not restarted', async () => {
      const api = await start()
      db.$queryRaw.mockRejectedValue(new Error('connection refused'))

      const response = await api.inject({ method: 'GET', url: '/health' })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /health/ready', () => {
    it('answers 200 when the database is up', async () => {
      const api = await start()

      const response = await api.inject({ method: 'GET', url: '/health/ready' })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ status: 'ready', checks: { database: 'up' } })
    })

    it('answers 503 when the database is down', async () => {
      const api = await start()
      db.$queryRaw.mockRejectedValue(new Error('connection refused'))

      const response = await api.inject({ method: 'GET', url: '/health/ready' })

      expect(response.statusCode).toBe(503)
      expect(response.json()).toEqual({ status: 'unavailable', checks: { database: 'down' } })
    })

    it('checks the database on every call instead of caching the result', async () => {
      const api = await start()
      db.$queryRaw.mockRejectedValueOnce(new Error('connection refused'))

      const first = await api.inject({ method: 'GET', url: '/health/ready' })
      const second = await api.inject({ method: 'GET', url: '/health/ready' })

      expect([first.statusCode, second.statusCode]).toEqual([503, 200])
      expect(db.$queryRaw).toHaveBeenCalledTimes(2)
    })

    it('answers 503 with a real client when nothing listens at DATABASE_URL', async () => {
      // Nothing listens on port 1, so connecting fails right away; no database needed.
      app = await buildApp(
        testEnv({ DATABASE_URL: 'postgresql://hostly:hostly@127.0.0.1:1/hostly_test' }),
      )

      const response = await app.inject({ method: 'GET', url: '/health/ready' })

      expect(response.statusCode).toBe(503)
      expect(response.json()).toEqual({ status: 'unavailable', checks: { database: 'down' } })
    })

    it('is never rate limited', async () => {
      await app?.close()
      app = await buildApp(testEnv({ RATE_LIMIT_MAX: '1' }), { db: fakeDatabase() })

      const statuses = []
      for (let i = 0; i < 3; i++) {
        statuses.push((await app.inject({ method: 'GET', url: '/health/ready' })).statusCode)
      }

      expect(statuses).toEqual([200, 200, 200])
    })
  })

  it('documents both routes with their responses', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/docs/json' })

    const { paths } = response.json<{
      paths: Record<string, { get: { responses: Record<string, unknown> } }>
    }>()
    expect(Object.keys(paths['/health']?.get.responses ?? {})).toEqual(['200'])
    expect(Object.keys(paths['/health/ready']?.get.responses ?? {})).toEqual(['200', '503'])
  })
})
