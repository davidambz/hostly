import { describe, expect, it } from 'vitest'

import { InvalidEnvError, loadEnv } from './env.js'

describe('loadEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3333,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5173'],
      RATE_LIMIT_MAX: 100,
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
    })

    expect(env).toEqual(loadEnv({}))
  })

  it('reads and coerces the values that are set', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://hostly.app',
      RATE_LIMIT_MAX: '20',
    })

    expect(env).toEqual({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: 8080,
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: ['https://hostly.app'],
      RATE_LIMIT_MAX: 20,
    })
  })

  it('splits CORS_ORIGINS on commas and trims each origin', () => {
    const env = loadEnv({ CORS_ORIGINS: 'https://hostly.app , http://localhost:5173' })

    expect(env.CORS_ORIGINS).toEqual(['https://hostly.app', 'http://localhost:5173'])
  })

  it('ignores unknown variables', () => {
    expect(loadEnv({ SOMETHING_ELSE: 'x' })).toEqual(loadEnv({}))
  })

  it.each([
    ['NODE_ENV', 'staging'],
    ['PORT', 'abc'],
    ['PORT', '0'],
    ['PORT', '70000'],
    ['PORT', '80.5'],
    ['LOG_LEVEL', 'verbose'],
    ['CORS_ORIGINS', 'not-a-url'],
    ['CORS_ORIGINS', 'https://hostly.app,'],
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
