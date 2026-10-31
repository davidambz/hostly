import { describe, expect, it } from 'vitest'

import { DEV_JWT_SECRET_PREFIX, InvalidEnvError, loadEnv } from './env.js'

const DATABASE_URL = 'postgresql://hostly:hostly@localhost:5432/hostly'
const JWT_SECRET = 'a-real-secret-that-is-at-least-32-characters'
const base = { DATABASE_URL, JWT_SECRET }

describe('loadEnv', () => {
  it('applies safe production defaults when nothing is set', () => {
    expect(loadEnv(base)).toEqual({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3333,
      DATABASE_URL,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
      RATE_LIMIT_MAX: 100,
      AUTH_RATE_LIMIT_MAX: 10,
      TRUST_PROXY: false,
      DOCS_ENABLED: false,
      JWT_SECRET,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      COOKIE_SECURE: true,
    })
  })

  it('treats empty strings as unset, like the keys in .env.example', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: '',
      HOST: '',
      PORT: '',
      LOG_LEVEL: '',
      CORS_ORIGINS: '',
      RATE_LIMIT_MAX: '',
      AUTH_RATE_LIMIT_MAX: '',
      TRUST_PROXY: '',
      DOCS_ENABLED: '',
      ACCESS_TOKEN_TTL_SECONDS: '',
      REFRESH_TOKEN_TTL_DAYS: '',
      COOKIE_SECURE: '',
    })

    expect(env).toEqual(loadEnv(base))
  })

  it('reads and coerces the values that are set', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://hostly.app',
      RATE_LIMIT_MAX: '20',
      AUTH_RATE_LIMIT_MAX: '5',
      TRUST_PROXY: 'true',
      DOCS_ENABLED: 'false',
      ACCESS_TOKEN_TTL_SECONDS: '300',
      REFRESH_TOKEN_TTL_DAYS: '7',
      COOKIE_SECURE: 'true',
    })

    expect(env).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 8080,
      DATABASE_URL,
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: ['https://hostly.app'],
      RATE_LIMIT_MAX: 20,
      AUTH_RATE_LIMIT_MAX: 5,
      TRUST_PROXY: true,
      DOCS_ENABLED: false,
      JWT_SECRET,
      ACCESS_TOKEN_TTL_SECONDS: 300,
      REFRESH_TOKEN_TTL_DAYS: 7,
      COOKIE_SECURE: true,
    })
  })

  it('ignores unknown variables', () => {
    expect(loadEnv({ ...base, SOMETHING_ELSE: 'x' })).toEqual(loadEnv(base))
  })

  describe('JWT_SECRET', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['shorter than 32 characters', 'a'.repeat(31)],
    ])('is rejected when %s', (_case, secret) => {
      expect(() => loadEnv({ DATABASE_URL, JWT_SECRET: secret })).toThrow(
        expect.objectContaining({ message: expect.stringContaining('JWT_SECRET') as string }),
      )
    })

    it('accepts the development secret outside production', () => {
      const secret = `${DEV_JWT_SECRET_PREFIX}secret-long-enough-for-the-minimum`

      expect(
        loadEnv({ DATABASE_URL, JWT_SECRET: secret, NODE_ENV: 'development' }).JWT_SECRET,
      ).toBe(secret)
    })

    it('refuses the development secret in production', () => {
      const secret = `${DEV_JWT_SECRET_PREFIX}secret-long-enough-for-the-minimum`

      expect(() => loadEnv({ DATABASE_URL, JWT_SECRET: secret, NODE_ENV: 'production' })).toThrow(
        /development JWT secret must not be used in production/,
      )
    })
  })

  describe('COOKIE_SECURE', () => {
    it.each([
      ['development', false],
      ['test', false],
      ['production', true],
    ])('defaults to the NODE_ENV (%s → %o)', (nodeEnv, expected) => {
      expect(loadEnv({ ...base, NODE_ENV: nodeEnv }).COOKIE_SECURE).toBe(expected)
    })

    it('can be turned off explicitly, e.g. for production over plain HTTP behind a proxy', () => {
      expect(
        loadEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' }).COOKIE_SECURE,
      ).toBe(false)
    })
  })

  describe('DATABASE_URL', () => {
    it.each([
      'postgresql://hostly:hostly@localhost:5432/hostly',
      'postgres://user:p%40ss@db.internal:6543/app?sslmode=require',
    ])('accepts %s', (url) => {
      expect(loadEnv({ ...base, DATABASE_URL: url }).DATABASE_URL).toBe(url)
    })

    it.each([
      ['missing', undefined],
      ['empty, as in .env.example', ''],
      ['not a URL', 'localhost:5432'],
      ['another database', 'mysql://root@localhost:3306/hostly'],
    ])('rejects a URL that is %s', (_case, url) => {
      expect(() => loadEnv({ JWT_SECRET, DATABASE_URL: url })).toThrow(
        expect.objectContaining({
          name: 'InvalidEnvError',
          message: expect.stringContaining('DATABASE_URL') as string,
        }),
      )
    })
  })

  describe('CORS_ORIGINS', () => {
    it('splits on commas and trims each origin', () => {
      const env = loadEnv({ ...base, CORS_ORIGINS: 'https://hostly.app , http://localhost:5173' })

      expect(env.CORS_ORIGINS).toEqual(['https://hostly.app', 'http://localhost:5173'])
    })

    it.each([
      'not-a-url',
      'https://hostly.app,',
      'https://hostly.app/',
      'https://hostly.app/app',
      'https://hostly.app?x=1',
      'ftp://hostly.app',
      'hostly.app',
    ])('rejects %s, which a browser Origin header could never match', (value) => {
      expect(() => loadEnv({ ...base, CORS_ORIGINS: value })).toThrow(InvalidEnvError)
    })
  })

  describe('TRUST_PROXY', () => {
    it.each([
      ['true', true],
      ['false', false],
    ])('reads %s as %o', (value, expected) => {
      expect(loadEnv({ ...base, TRUST_PROXY: value }).TRUST_PROXY).toBe(expected)
    })

    it.each(['yes', '1', 'TRUE'])('rejects %s', (value) => {
      expect(() => loadEnv({ ...base, TRUST_PROXY: value })).toThrow(InvalidEnvError)
    })
  })

  describe('DOCS_ENABLED', () => {
    it.each([
      ['development', true],
      ['test', true],
      ['production', false],
    ])('defaults to the NODE_ENV (%s → %o)', (nodeEnv, expected) => {
      expect(loadEnv({ ...base, NODE_ENV: nodeEnv }).DOCS_ENABLED).toBe(expected)
    })

    it('can be turned on explicitly in production', () => {
      expect(loadEnv({ ...base, NODE_ENV: 'production', DOCS_ENABLED: 'true' }).DOCS_ENABLED).toBe(
        true,
      )
    })

    it('can be turned off explicitly in development', () => {
      expect(
        loadEnv({ ...base, NODE_ENV: 'development', DOCS_ENABLED: 'false' }).DOCS_ENABLED,
      ).toBe(false)
    })

    it('rejects anything that is not true or false', () => {
      expect(() => loadEnv({ ...base, DOCS_ENABLED: '1' })).toThrow(InvalidEnvError)
    })
  })

  it.each([
    ['NODE_ENV', 'staging'],
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['PORT', '70000'],
    ['PORT', '80.5'],
    ['LOG_LEVEL', 'verbose'],
    ['RATE_LIMIT_MAX', '0'],
    ['RATE_LIMIT_MAX', '-5'],
    ['AUTH_RATE_LIMIT_MAX', '0'],
    ['AUTH_RATE_LIMIT_MAX', 'abc'],
  ])('rejects %s=%s', (key, value) => {
    expect(() => loadEnv({ ...base, [key]: value })).toThrow(InvalidEnvError)
  })

  it('names every invalid variable in the error message', () => {
    expect(() => loadEnv({ ...base, PORT: 'abc', LOG_LEVEL: 'verbose' })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/PORT[\s\S]*LOG_LEVEL|LOG_LEVEL[\s\S]*PORT/) as string,
      }),
    )
  })
})
