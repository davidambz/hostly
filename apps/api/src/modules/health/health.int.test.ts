import { afterEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import { testEnv } from '../../test/env.js'
import { testDatabase } from '../../test/integration/database.js'

let app: App | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('health against a real database', () => {
  it('is ready when Postgres answers', async () => {
    app = await buildApp(testEnv(), { db: testDatabase() })

    const response = await app.inject({ method: 'GET', url: '/health/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready', checks: { database: 'up' } })
  })

  it('is unavailable when Postgres cannot be reached', async () => {
    // Nothing listens on port 1, so connecting fails right away.
    app = await buildApp(
      testEnv({ DATABASE_URL: 'postgresql://hostly:hostly@127.0.0.1:1/hostly_test' }),
    )

    const response = await app.inject({ method: 'GET', url: '/health/ready' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'unavailable', checks: { database: 'down' } })
  })
})
