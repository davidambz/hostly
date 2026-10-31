import { describe, expect, it } from 'vitest'

import { InvalidEnvError, loadEnv } from './env.js'

describe('loadEnv', () => {
  it('applies safe production defaults when nothing is set', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3333,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
      RATE_LIMIT_MAX: 100,
      TRUST_PROXY: false,
      DOCS_ENABLED: false,
    })
  })

  it('treats empty strings as unset, like the keys in .env.example', () => {
    const env = loadEnv({
      NODE_ENV: '',
      HOST: '',
      PORT: '',
      LOG_LEVEL: '',
      CORS_ORIGINS: '',
      RATE_LIMIT_MAX: '',
      TRUST_PROXY: '',
      DOCS_ENABLED: '',
    })

    expect(env).toEqual(loadEnv({}))
  })

  it('reads and coerces the values that are set', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://hostly.app',
      RATE_LIMIT_MAX: '20',
      TRUST_PROXY: 'true',
      DOCS_ENABLED: 'false',
    })

    expect(env).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 8080,
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: ['https://hostly.app'],
      RATE_LIMIT_MAX: 20,
      TRUST_PROXY: true,
      DOCS_ENABLED: false,
    })
  })

  it('ignores unknown variables', () => {
    expect(loadEnv({ SOMETHING_ELSE: 'x' })).toEqual(loadEnv({}))
  })

  describe('CORS_ORIGINS', () => {
    it('splits on commas and trims each origin', () => {
      const env = loadEnv({ CORS_ORIGINS: 'https://hostly.app , http://localhost:5173' })

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
      expect(() => loadEnv({ CORS_ORIGINS: value })).toThrow(InvalidEnvError)
    })
  })

  describe('TRUST_PROXY', () => {
    it.each([
      ['true', true],
      ['false', false],
    ])('reads %s as %o', (value, expected) => {
      expect(loadEnv({ TRUST_PROXY: value }).TRUST_PROXY).toBe(expected)
    })

    it.each(['yes', '1', 'TRUE'])('rejects %s', (value) => {
      expect(() => loadEnv({ TRUST_PROXY: value })).toThrow(InvalidEnvError)
    })
  })

  describe('DOCS_ENABLED', () => {
    it.each([
      ['development', true],
      ['test', true],
      ['production', false],
    ])('defaults to the NODE_ENV (%s → %o)', (nodeEnv, expected) => {
      expect(loadEnv({ NODE_ENV: nodeEnv }).DOCS_ENABLED).toBe(expected)
    })

    it('can be turned on explicitly in production', () => {
      expect(loadEnv({ NODE_ENV: 'production', DOCS_ENABLED: 'true' }).DOCS_ENABLED).toBe(true)
    })

    it('can be turned off explicitly in development', () => {
      expect(loadEnv({ NODE_ENV: 'development', DOCS_ENABLED: 'false' }).DOCS_ENABLED).toBe(false)
    })

    it('rejects anything that is not true or false', () => {
      expect(() => loadEnv({ DOCS_ENABLED: '1' })).toThrow(InvalidEnvError)
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
  ])('rejects %s=%s', (key, value) => {
    expect(() => loadEnv({ [key]: value })).toThrow(InvalidEnvError)
  })

  it('names every invalid variable in the error message', () => {
    expect(() => loadEnv({ PORT: 'abc', LOG_LEVEL: 'verbose' })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/PORT[\s\S]*LOG_LEVEL|LOG_LEVEL[\s\S]*PORT/) as string,
      }),
    )
  })
})
