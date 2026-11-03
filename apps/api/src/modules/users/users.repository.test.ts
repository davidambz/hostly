import { describe, expect, it, vi } from 'vitest'

import { Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { UsersRepository } from './users.repository.js'

const newUser = {
  name: 'Ana',
  email: 'ana@hostly.dev',
  passwordHash: 'hash',
}

function uniqueViolation(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  })
}

function repositoryFailingWith(error: unknown) {
  const db = { user: { create: vi.fn().mockRejectedValue(error) } }
  return new UsersRepository(db as unknown as Database)
}

describe('UsersRepository.create', () => {
  it.each([
    [
      'the adapter constraint users_email_key',
      { driverAdapterError: { cause: { constraint: { index: 'users_email_key' } } } },
      'email',
    ],
    ['meta.target [email]', { target: ['email'] }, 'email'],
  ])('reports a violation found through %s as a UniqueFieldError', async (_case, meta, field) => {
    const error = await repositoryFailingWith(uniqueViolation(meta))
      .create(newUser)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UniqueFieldError)
    expect(error).toMatchObject({ field })
  })

  it.each([
    ['meta.target [cpf]', { target: ['cpf'] }],
    [
      'the adapter constraint users_cpf_key',
      { driverAdapterError: { cause: { constraint: { index: 'users_cpf_key' } } } },
    ],
  ])(
    'lets a violation of any other unique constraint (%s) through untouched',
    async (_case, meta) => {
      const violation = uniqueViolation(meta)

      await expect(repositoryFailingWith(violation).create(newUser)).rejects.toBe(violation)
    },
  )

  it('lets any other database error through untouched', async () => {
    const failure = new Error('connection reset')

    await expect(repositoryFailingWith(failure).create(newUser)).rejects.toBe(failure)
  })
})

describe('UsersRepository.existsByEmail', () => {
  it.each([
    ['an account', { id: 'u1' }, true],
    ['no account', null, false],
  ])('answers whether the e-mail has %s, reading only the id', async (_case, row, expected) => {
    const findUnique = vi.fn().mockResolvedValue(row)
    const repository = new UsersRepository({ user: { findUnique } } as unknown as Database)

    await expect(repository.existsByEmail('ana@hostly.dev')).resolves.toBe(expected)
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'ana@hostly.dev' },
      select: { id: true },
    })
  })
})
