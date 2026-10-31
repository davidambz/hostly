import { describe, expect, it } from 'vitest'

import { generateRefreshToken, hashRefreshToken } from './refresh-token.js'

describe('refresh tokens', () => {
  it('are 256-bit URL-safe random strings', () => {
    const token = generateRefreshToken()

    expect(token).toMatch(/^[\w-]{43}$/)
  })

  it('never repeat', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateRefreshToken))

    expect(tokens.size).toBe(1000)
  })

  it('are stored as their SHA-256, hex', () => {
    expect(hashRefreshToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'))
    expect(hashRefreshToken('abd')).not.toBe(hashRefreshToken('abc'))
  })
})
