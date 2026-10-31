import { describe, expect, it, vi } from 'vitest'

import type { User } from '../../generated/prisma/client.js'
import { ConflictError } from '../../shared/errors.js'
import type { NewUser } from '../users/users.repository.js'
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
    create: vi.fn((data: NewUser) =>
      Promise.resolve({
        ...data,
        id: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies User),
    ),
  }
  const hashPassword = vi.fn((password: string) => Promise.resolve(`hashed:${password}`))
  return { users, hashPassword, service: new AuthService({ users, hashPassword }) }
}

describe('AuthService.register', () => {
  it('stores the profile with the hashed password', async () => {
    const { users, hashPassword, service } = setup()

    const user = await service.register(input)

    expect(hashPassword).toHaveBeenCalledWith('correct horse')
    expect(users.create).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@hostly.dev',
      cpf: '52998224725',
      phone: '48999990000',
      passwordHash: 'hashed:correct horse',
    })
    expect(user.id).toBe('u1')
  })

  it('never hands the plain password to the repository', async () => {
    const { users, service } = setup()

    await service.register(input)

    expect(JSON.stringify(users.create.mock.calls)).not.toContain('"password"')
  })

  it('lets a conflict from the repository through', async () => {
    const { users, service } = setup()
    const conflict = new ConflictError('E-mail already registered', { code: 'EMAIL_TAKEN' })
    users.create.mockRejectedValueOnce(conflict)

    await expect(service.register(input)).rejects.toBe(conflict)
  })

  it('does not create anything when hashing fails', async () => {
    const { users, hashPassword, service } = setup()
    hashPassword.mockRejectedValueOnce(new Error('out of memory'))

    await expect(service.register(input)).rejects.toThrow('out of memory')
    expect(users.create).not.toHaveBeenCalled()
  })
})
