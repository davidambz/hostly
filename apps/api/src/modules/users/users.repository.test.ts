import { describe, expect, it, vi } from 'vitest'

import { Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { UsersRepository } from './users.repository.js'

const newUser = {
  name: 'Ana',
  email: 'ana@hostly.dev',
  cpf: '52998224725',
  phone: '48999990000',
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
    [
      'the adapter constraint users_cpf_key',
      { driverAdapterError: { cause: { constraint: { index: 'users_cpf_key' } } } },
      'cpf',
    ],
    ['meta.target [email]', { target: ['email'] }, 'email'],
    ['meta.target cpf', { target: 'cpf' }, 'cpf'],
  ])('reports a violation found through %s as a UniqueFieldError', async (_case, meta, field) => {
    const error = await repositoryFailingWith(uniqueViolation(meta))
      .create(newUser)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UniqueFieldError)
    expect(error).toMatchObject({ field })
  })

  it('lets a violation of any other unique constraint through untouched', async () => {
    const violation = uniqueViolation({ target: ['phone'] })

    await expect(repositoryFailingWith(violation).create(newUser)).rejects.toBe(violation)
  })

  it('lets any other database error through untouched', async () => {
    const failure = new Error('connection reset')

    await expect(repositoryFailingWith(failure).create(newUser)).rejects.toBe(failure)
  })
})
