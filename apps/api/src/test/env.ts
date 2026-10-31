import { type Env, loadEnv } from '../config/env.js'

/** Never connected to by the unit tests, which inject a fake database. */
const TEST_DATABASE_URL = 'postgresql://hostly:hostly@localhost:5432/hostly_test'

export function testEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    ...overrides,
  })
}
