import { describe, expect, it, vi } from 'vitest'

import type { User } from '../../generated/prisma/client.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { ConflictError } from '../../shared/errors.js'
import type { NewUser, UserUniqueField } from '../users/users.repository.js'
import { AuthService } from './auth.service.js'

const input = {
  name: 'Ana Souza',
  email: 'ana@hostly.dev',
  cpf: '52998224725',
  phone: '48999990000',
  password: 'correct horse',
}

function setup() {
  const users = {
    takenFields: vi.fn<() => Promise<UserUniqueField[]>>().mockResolvedValue([]),
    create: vi.fn((data: NewUser) =>
      Promise.resolve({
        ...data,
        id: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies User),
    ),
  }
  const hashPassword = vi.fn((_password: string) => Promise.resolve('$argon2id$fake-hash'))
  return { users, hashPassword, service: new AuthService({ users, hashPassword }) }
}

describe('AuthService.register', () => {
  it('stores the profile with the hashed password', async () => {
    const { users, hashPassword, service } = setup()

    const user = await service.register(input)

    expect(users.takenFields).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@hostly.dev', cpf: '52998224725' }),
    )
    expect(hashPassword).toHaveBeenCalledWith('correct horse')
    expect(users.create).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@hostly.dev',
      cpf: '52998224725',
      phone: '48999990000',
      passwordHash: '$argon2id$fake-hash',
    })
    expect(user.id).toBe('u1')
  })

  it('never hands the plain password to the repository', async () => {
    const { users, service } = setup()

    await service.register(input)

    expect(JSON.stringify([users.create.mock.calls, users.takenFields.mock.calls])).not.toContain(
      'correct horse',
    )
  })

  it.each([
    ['email', 'EMAIL_TAKEN', 'E-mail already registered'],
    ['cpf', 'CPF_TAKEN', 'CPF already registered'],
  ] as const)(
    'answers %s taken with a 409 %s, without paying for a hash',
    async (field, code, message) => {
      const { users, hashPassword, service } = setup()
      users.takenFields.mockResolvedValueOnce([field])

      const error = await service.register(input).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ConflictError)
      expect(error).toMatchObject({ statusCode: 409, code, message, details: { field } })
      expect(hashPassword).not.toHaveBeenCalled()
      expect(users.create).not.toHaveBeenCalled()
    },
  )

  it('reports the e-mail first when both are taken', async () => {
    const { users, service } = setup()
    users.takenFields.mockResolvedValueOnce(['email', 'cpf'])

    await expect(service.register(input)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('turns a unique violation from a race after the check into the same 409', async () => {
    const { users, service } = setup()
    users.create.mockRejectedValueOnce(new UniqueFieldError('cpf'))

    await expect(service.register(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CPF_TAKEN',
      details: { field: 'cpf' },
    })
  })

  it('lets any other repository error through', async () => {
    const { users, service } = setup()
    const failure = new Error('connection reset')
    users.create.mockRejectedValueOnce(failure)

    await expect(service.register(input)).rejects.toBe(failure)
  })

  it('does not create anything when hashing fails', async () => {
    const { users, hashPassword, service } = setup()
    hashPassword.mockRejectedValueOnce(new Error('out of memory'))

    await expect(service.register(input)).rejects.toThrow('out of memory')
    expect(users.create).not.toHaveBeenCalled()
  })
})
