import { afterEach, describe, expect, it, vi } from 'vitest'

import { testDatabaseUrl } from './database-url.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('testDatabaseUrl', () => {
  it('defaults to the local hostly_test database', () => {
    vi.stubEnv('TEST_DATABASE_URL', '')

    expect(testDatabaseUrl().toString()).toBe(
      'postgresql://hostly:hostly@localhost:5432/hostly_test',
    )
  })

  it('uses TEST_DATABASE_URL when set', () => {
    vi.stubEnv('TEST_DATABASE_URL', 'postgresql://ci:ci@postgres:5432/api_test')

    expect(testDatabaseUrl().pathname).toBe('/api_test')
  })

  it.each(['hostly', 'hostly_test_backup', 'production'])(
    'refuses a database named %s, which it would drop',
    (name) => {
      vi.stubEnv('TEST_DATABASE_URL', `postgresql://hostly:hostly@localhost:5432/${name}`)

      expect(() => testDatabaseUrl()).toThrow(/must end in "_test"/)
    },
  )
})
