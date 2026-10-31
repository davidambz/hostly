import { type Env, loadEnv } from '../config/env.js'

export function testEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  return loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...overrides })
}
