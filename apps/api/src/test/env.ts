import { type Env, loadEnv } from '../config/env.js'
import { DEFAULT_TEST_DATABASE_URL } from './integration/database-url.js'

export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'

/**
 * Env for tests. DATABASE_URL points at the integration test database; unit tests
 * inject a fake database instead, so they never connect to it.
 */
export function testEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: DEFAULT_TEST_DATABASE_URL,
    JWT_SECRET: TEST_JWT_SECRET,
    // High enough that suites creating many users never hit it; tests of the limit lower it.
    AUTH_RATE_LIMIT_MAX: '1000',
    ...overrides,
  })
}
