import { describe, expect, it } from 'vitest'

import { publicUserSchema, toPublicUser } from './users.schemas.js'

describe('toPublicUser', () => {
  const user = {
    id: '018f0000-0000-7000-8000-000000000001',
    name: 'Ana Souza',
    email: 'ana@hostly.dev',
    cpf: '52998224725',
    phone: '48999990000',
    passwordHash: '$argon2id$secret',
    createdAt: new Date('2026-10-31T12:00:00.000Z'),
    updatedAt: new Date('2026-10-31T13:00:00.000Z'),
  }

  it('keeps only the public fields, with ISO dates', () => {
    expect(toPublicUser(user)).toEqual({
      id: user.id,
      name: 'Ana Souza',
      email: 'ana@hostly.dev',
      cpf: '52998224725',
      phone: '48999990000',
      createdAt: '2026-10-31T12:00:00.000Z',
    })
  })

  it('never exposes the password hash', () => {
    expect(JSON.stringify(toPublicUser(user))).not.toContain('argon2')
  })

  it('matches the response schema', () => {
    expect(publicUserSchema.safeParse(toPublicUser(user)).success).toBe(true)
  })
})
