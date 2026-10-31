import { describe, expect, it } from 'vitest'

import { hashPassword, verifyPassword } from './password.js'

describe('password hashing', () => {
  it('produces an argon2id hash, never the password itself', async () => {
    const hash = await hashPassword('correct horse')

    expect(hash).toMatch(/^\$argon2id\$/)
    expect(hash).not.toContain('correct horse')
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse')

    await expect(verifyPassword(hash, 'correct horse')).resolves.toBe(true)
    await expect(verifyPassword(hash, 'Correct horse')).resolves.toBe(false)
    await expect(verifyPassword(hash, '')).resolves.toBe(false)
  })

  it('treats a malformed hash as a mismatch instead of throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false)
  })
})
