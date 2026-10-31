import { afterEach, describe, expect, it, vi } from 'vitest'

import { type App, buildApp } from '../../app.js'
import { testEnv } from '../../test/env.js'
import { type FakeDatabase, fakeDatabase } from '../../test/fake-database.js'
import { DATABASE_CHECK_TIMEOUT_MS, HealthService } from './health.service.js'

describe('HealthService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports ok when the database answers', async () => {
    const db = fakeDatabase()

    await expect(new HealthService(db).check()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up' },
    })
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('reports unavailable when the database query fails', async () => {
    const db = fakeDatabase()
    db.$queryRaw.mockRejectedValue(new Error('connection refused'))

    await expect(new HealthService(db).check()).resolves.toEqual({
      status: 'unavailable',
      checks: { database: 'down' },
    })
  })

  it('reports unavailable when the database hangs past the timeout', async () => {
    vi.useFakeTimers()
    const db = fakeDatabase()
    db.$queryRaw.mockReturnValue(new Promise(() => undefined))

    const report = new HealthService(db).check()
    await vi.advanceTimersByTimeAsync(DATABASE_CHECK_TIMEOUT_MS)

    await expect(report).resolves.toEqual({
      status: 'unavailable',
      checks: { database: 'down' },
    })
  })

  it('does not time out a database that answers just in time', async () => {
    vi.useFakeTimers()
    const db = fakeDatabase()
    db.$queryRaw.mockReturnValue(
      new Promise((resolve) => setTimeout(resolve, DATABASE_CHECK_TIMEOUT_MS - 1)),
    )

    const report = new HealthService(db).check()
    await vi.advanceTimersByTimeAsync(DATABASE_CHECK_TIMEOUT_MS - 1)

    await expect(report).resolves.toMatchObject({ status: 'ok' })
  })

  it('clears the timeout timer once the check is done', async () => {
    vi.useFakeTimers()

    await new HealthService(fakeDatabase()).check()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('GET /health', () => {
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

  it('answers 200 when the database is up', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toMatch(/^application\/json/)
    expect(response.json()).toEqual({ status: 'ok', checks: { database: 'up' } })
  })

  it('answers 503 when the database is down', async () => {
    const api = await start()
    db.$queryRaw.mockRejectedValue(new Error('connection refused'))

    const response = await api.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'unavailable', checks: { database: 'down' } })
  })

  it('checks the database on every call instead of caching the result', async () => {
    const api = await start()
    db.$queryRaw.mockRejectedValueOnce(new Error('connection refused'))

    const first = await api.inject({ method: 'GET', url: '/health' })
    const second = await api.inject({ method: 'GET', url: '/health' })

    expect([first.statusCode, second.statusCode]).toEqual([503, 200])
    expect(db.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('is documented with both responses', async () => {
    const api = await start()

    const response = await api.inject({ method: 'GET', url: '/docs/json' })

    const responses = response.json<{
      paths: Record<string, { get: { responses: Record<string, unknown> } }>
    }>().paths['/health']?.get.responses
    expect(Object.keys(responses ?? {})).toEqual(['200', '503'])
  })
})
