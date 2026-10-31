import { describe, expect, it, vi } from 'vitest'

import { Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { ConflictError } from '../../shared/errors.js'
import { UsersRepository } from './users.repository.js'

const newUser = {
  name: 'Ana',
  email: 'ana@hostly.dev',
  cpf: '52998224725',
  phone: '48999990000',
  passwordHash: 'hash',
}

function uniqueViolation(index: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { driverAdapterError: { cause: { constraint: { index } } } },
  })
}

function repositoryFailingWith(error: unknown) {
  const db = { user: { create: vi.fn().mockRejectedValue(error) } }
  return new UsersRepository(db as unknown as Database)
}

describe('UsersRepository.create', () => {
  it.each([
    ['users_email_key', 'EMAIL_TAKEN', 'email'],
    ['users_cpf_key', 'CPF_TAKEN', 'cpf'],
  ])('turns a violation of %s into a 409 %s', async (index, code, field) => {
    const error = await repositoryFailingWith(uniqueViolation(index))
      .create(newUser)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code, details: { field } })
  })

  it('lets a violation of any other unique constraint through untouched', async () => {
    const violation = uniqueViolation('users_something_else_key')

    await expect(repositoryFailingWith(violation).create(newUser)).rejects.toBe(violation)
  })

  it('lets any other database error through untouched', async () => {
    const failure = new Error('connection reset')

    await expect(repositoryFailingWith(failure).create(newUser)).rejects.toBe(failure)
  })
})
