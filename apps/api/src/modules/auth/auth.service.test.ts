import { describe, expect, it, vi } from 'vitest'

import type { RefreshToken, User } from '../../generated/prisma/client.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { ConflictError, UnauthorizedError } from '../../shared/errors.js'
import type { NewUser, UserUniqueField } from '../users/users.repository.js'
import { AuthService, ROTATION_GRACE_MS } from './auth.service.js'
import { hashRefreshToken } from './refresh-token.js'
import type { NewRefreshToken } from './refresh-tokens.repository.js'

const NOW = new Date('2026-10-31T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

const registerInput = {
  name: 'Ana Souza',
  email: 'ana@hostly.dev',
  cpf: '52998224725',
  phone: '48999990000',
  password: 'correct horse',
}

const existingUser: User = {
  id: 'u1',
  name: 'Ana Souza',
  email: 'ana@hostly.dev',
  cpf: '52998224725',
  phone: '48999990000',
  passwordHash: '$argon2id$real-hash',
  createdAt: NOW,
  updatedAt: NOW,
}

function storedToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'rt1',
    userId: 'u1',
    tokenHash: hashRefreshToken('the-token'),
    familyId: 'family-1',
    expiresAt: new Date(NOW.getTime() + DAY_MS),
    revokedAt: null,
    revokedReason: null,
    createdAt: NOW,
    ...overrides,
  }
}

function setup() {
  const users = {
    takenFields: vi.fn<() => Promise<UserUniqueField[]>>().mockResolvedValue([]),
    create: vi.fn((data: NewUser) =>
      Promise.resolve({ ...data, id: 'u1', createdAt: NOW, updatedAt: NOW } satisfies User),
    ),
    findByEmail: vi.fn<(email: string) => Promise<User | null>>().mockResolvedValue(existingUser),
  }
  const refreshTokens = {
    create: vi.fn((data: NewRefreshToken) =>
      Promise.resolve(storedToken({ ...data, id: 'rt-new' })),
    ),
    findByHash: vi.fn<(hash: string) => Promise<RefreshToken | null>>().mockResolvedValue(null),
    replace: vi
      .fn<(id: string, next: NewRefreshToken, at: Date) => Promise<boolean>>()
      .mockResolvedValue(true),
    revokeFamily: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteExpired: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
  const hashPassword = vi.fn((_password: string) => Promise.resolve('$argon2id$fake-hash'))
  const verifyPassword = vi.fn((hash: string, password: string) =>
    Promise.resolve(hash === '$argon2id$real-hash' && password === 'correct horse'),
  )
  const signAccessToken = vi.fn((userId: string) => `access-for-${userId}`)
  const service = new AuthService({
    users,
    refreshTokens,
    hashPassword,
    verifyPassword,
    signAccessToken,
    refreshTokenTtlMs: 30 * DAY_MS,
    now: () => NOW,
  })
  return { users, refreshTokens, hashPassword, verifyPassword, signAccessToken, service }
}

async function rejectionOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected a rejection')
    },
    (error: unknown) => error,
  )
}

describe('AuthService.register', () => {
  it('stores the profile with the hashed password', async () => {
    const { users, hashPassword, service } = setup()

    const user = await service.register(registerInput)

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

    await service.register(registerInput)

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

      const error = await rejectionOf(service.register(registerInput))

      expect(error).toBeInstanceOf(ConflictError)
      expect(error).toMatchObject({ statusCode: 409, code, message, details: { field } })
      expect(hashPassword).not.toHaveBeenCalledWith('correct horse')
      expect(users.create).not.toHaveBeenCalled()
    },
  )

  it('reports the e-mail first when both are taken', async () => {
    const { users, service } = setup()
    users.takenFields.mockResolvedValueOnce(['email', 'cpf'])

    await expect(service.register(registerInput)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('turns a unique violation from a race after the check into the same 409', async () => {
    const { users, service } = setup()
    users.create.mockRejectedValueOnce(new UniqueFieldError('cpf'))

    await expect(service.register(registerInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CPF_TAKEN',
      details: { field: 'cpf' },
    })
  })

  it('lets any other repository error through', async () => {
    const { users, service } = setup()
    const failure = new Error('connection reset')
    users.create.mockRejectedValueOnce(failure)

    await expect(service.register(registerInput)).rejects.toBe(failure)
  })

  it('does not create anything when hashing fails', async () => {
    const { users, hashPassword, service } = setup()
    hashPassword.mockRejectedValueOnce(new Error('out of memory'))

    await expect(service.register(registerInput)).rejects.toThrow('out of memory')
    expect(users.create).not.toHaveBeenCalled()
  })
})

describe('AuthService.login', () => {
  const credentials = { email: 'ana@hostly.dev', password: 'correct horse' }

  it('starts a session in a new family, valid for the configured TTL', async () => {
    const { refreshTokens, signAccessToken, service } = setup()

    const { user, session } = await service.login(credentials)

    expect(user).toBe(existingUser)
    expect(signAccessToken).toHaveBeenCalledWith('u1')
    expect(session.accessToken).toBe('access-for-u1')
    expect(session.refreshToken).toMatch(/^[\w-]{43}$/)
    expect(session.refreshTokenExpiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS))
    expect(refreshTokens.create).toHaveBeenCalledWith({
      userId: 'u1',
      familyId: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      tokenHash: hashRefreshToken(session.refreshToken),
      expiresAt: session.refreshTokenExpiresAt,
    })
  })

  it('stores only the hash of the refresh token', async () => {
    const { refreshTokens, service } = setup()

    const { session } = await service.login(credentials)

    expect(JSON.stringify(refreshTokens.create.mock.calls)).not.toContain(session.refreshToken)
  })

  it('opens a separate family on every login', async () => {
    const { refreshTokens, service } = setup()

    await service.login(credentials)
    await service.login(credentials)

    const [first, second] = refreshTokens.create.mock.calls.map(([data]) => data.familyId)
    expect(first).not.toBe(second)
  })

  it("cleans up the user's expired refresh tokens", async () => {
    const { refreshTokens, service } = setup()

    await service.login(credentials)

    expect(refreshTokens.deleteExpired).toHaveBeenCalledWith('u1', NOW)
  })

  it('answers 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const { refreshTokens, service } = setup()

    const error = await rejectionOf(service.login({ ...credentials, password: 'wrong' }))

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(refreshTokens.create).not.toHaveBeenCalled()
  })

  it('answers the same for an unknown e-mail, after verifying a dummy hash', async () => {
    const { users, verifyPassword, refreshTokens, service } = setup()
    users.findByEmail.mockResolvedValue(null)

    const error = await rejectionOf(service.login(credentials))

    expect(error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid e-mail or password',
    })
    expect(verifyPassword).toHaveBeenCalledWith('$argon2id$fake-hash', 'correct horse')
    expect(refreshTokens.create).not.toHaveBeenCalled()
  })

  it('computes the dummy hash once, up front', async () => {
    const { users, hashPassword, service } = setup()
    users.findByEmail.mockResolvedValue(null)

    expect(hashPassword).toHaveBeenCalledTimes(1)
    await rejectionOf(service.login(credentials))
    await rejectionOf(service.login(credentials))

    expect(hashPassword).toHaveBeenCalledTimes(1)
  })

  it('retries the dummy hash after a failure instead of failing every unknown e-mail', async () => {
    const { users, refreshTokens } = setup()
    users.findByEmail.mockResolvedValue(null)
    const hashPassword = vi
      .fn<(password: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('out of memory'))
      .mockResolvedValue('$argon2id$dummy')
    const verifyPassword = vi.fn(() => Promise.resolve(false))
    const service = new AuthService({
      users,
      refreshTokens,
      hashPassword,
      verifyPassword,
      signAccessToken: () => 'a',
      refreshTokenTtlMs: DAY_MS,
      now: () => NOW,
    })
    // Let the eager attempt from the constructor fail.
    await new Promise((resolve) => setImmediate(resolve))

    await expect(service.login(credentials)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(hashPassword).toHaveBeenCalledTimes(2)
    expect(verifyPassword).toHaveBeenCalledWith('$argon2id$dummy', 'correct horse')
  })
})

describe('AuthService.refresh', () => {
  it('rotates the token within the same family, atomically', async () => {
    const { refreshTokens, service } = setup()
    refreshTokens.findByHash.mockResolvedValue(storedToken())

    const session = await service.refresh('the-token')

    expect(refreshTokens.findByHash).toHaveBeenCalledWith(hashRefreshToken('the-token'))
    expect(refreshTokens.replace).toHaveBeenCalledWith(
      'rt1',
      {
        userId: 'u1',
        familyId: 'family-1',
        tokenHash: hashRefreshToken(session.refreshToken),
        expiresAt: storedToken().expiresAt,
      },
      NOW,
    )
    expect(refreshTokens.create).not.toHaveBeenCalled()
    expect(session.accessToken).toBe('access-for-u1')
    expect(session.refreshToken).not.toBe('the-token')
  })

  it("keeps the login's expiry, so refreshing never extends a session", async () => {
    const { refreshTokens, service } = setup()
    const loginExpiry = new Date(NOW.getTime() + 2 * DAY_MS)
    refreshTokens.findByHash.mockResolvedValue(storedToken({ expiresAt: loginExpiry }))

    const session = await service.refresh('the-token')

    expect(session.refreshTokenExpiresAt).toEqual(loginExpiry)
  })

  it.each([
    ['no token', undefined],
    ['an empty token', ''],
  ])('answers 401 INVALID_REFRESH_TOKEN for %s', async (_case, token) => {
    const { refreshTokens, service } = setup()

    await expect(service.refresh(token)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' })
    expect(refreshTokens.findByHash).not.toHaveBeenCalled()
  })

  it('answers 401 INVALID_REFRESH_TOKEN for an unknown token', async () => {
    const { refreshTokens, service } = setup()

    await expect(service.refresh('who-knows')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    })
    expect(refreshTokens.replace).not.toHaveBeenCalled()
  })

  it('revokes the whole family when a token rotated long ago is presented again', async () => {
    const { refreshTokens, service } = setup()
    const rotatedAt = new Date(NOW.getTime() - ROTATION_GRACE_MS - 1)
    refreshTokens.findByHash.mockResolvedValue(
      storedToken({ revokedAt: rotatedAt, revokedReason: 'ROTATED' }),
    )

    await expect(service.refresh('the-token')).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSED',
    })
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-1', NOW, 'REUSE_DETECTED')
    expect(refreshTokens.replace).not.toHaveBeenCalled()
  })

  it.each([
    ['at the moment of rotation', 0],
    ['at the end of the grace period', ROTATION_GRACE_MS],
  ])(
    'answers the retryable REFRESH_TOKEN_ROTATED for a token rotated %s, without revoking',
    async (_case, agoMs) => {
      const { refreshTokens, service } = setup()
      refreshTokens.findByHash.mockResolvedValue(
        storedToken({ revokedAt: new Date(NOW.getTime() - agoMs), revokedReason: 'ROTATED' }),
      )

      await expect(service.refresh('the-token')).rejects.toMatchObject({
        code: 'REFRESH_TOKEN_ROTATED',
      })
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled()
    },
  )

  it.each(['LOGOUT', 'REUSE_DETECTED'] as const)(
    'answers 401 INVALID_REFRESH_TOKEN for a token revoked by %s, without flagging theft',
    async (revokedReason) => {
      const { refreshTokens, service } = setup()
      refreshTokens.findByHash.mockResolvedValue(storedToken({ revokedAt: NOW, revokedReason }))

      await expect(service.refresh('the-token')).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      })
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled()
      expect(refreshTokens.replace).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['at', NOW],
    ['before', new Date(NOW.getTime() - 1)],
  ])('answers 401 REFRESH_TOKEN_EXPIRED for a token that expired %s now', async (_case, at) => {
    const { refreshTokens, service } = setup()
    refreshTokens.findByHash.mockResolvedValue(storedToken({ expiresAt: at }))

    await expect(service.refresh('the-token')).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_EXPIRED',
    })
    expect(refreshTokens.replace).not.toHaveBeenCalled()
  })

  it('accepts a token one millisecond before it expires', async () => {
    const { refreshTokens, service } = setup()
    refreshTokens.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(NOW.getTime() + 1) }),
    )

    await expect(service.refresh('the-token')).resolves.toMatchObject({
      accessToken: 'access-for-u1',
    })
  })

  it('answers REFRESH_TOKEN_ROTATED when a concurrent refresh won the race', async () => {
    const { refreshTokens, signAccessToken, service } = setup()
    refreshTokens.findByHash.mockResolvedValue(storedToken())
    refreshTokens.replace.mockResolvedValue(false)

    await expect(service.refresh('the-token')).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_ROTATED',
    })
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled()
    expect(signAccessToken).not.toHaveBeenCalled()
  })
})

describe('AuthService.logout', () => {
  it('revokes the family of the token', async () => {
    const { refreshTokens, service } = setup()
    refreshTokens.findByHash.mockResolvedValue(storedToken())

    await service.logout('the-token')

    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-1', NOW, 'LOGOUT')
  })

  it('does nothing without a token', async () => {
    const { refreshTokens, service } = setup()

    await service.logout(undefined)

    expect(refreshTokens.findByHash).not.toHaveBeenCalled()
  })

  it('does nothing for an unknown token', async () => {
    const { refreshTokens, service } = setup()

    await expect(service.logout('who-knows')).resolves.toBeUndefined()
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled()
  })
})

it('defaults the clock to the current time', async () => {
  const { users, refreshTokens } = setup()
  const service = new AuthService({
    users,
    refreshTokens,
    hashPassword: () => Promise.resolve('h'),
    verifyPassword: () => Promise.resolve(true),
    signAccessToken: () => 'a',
    refreshTokenTtlMs: 1000,
  })
  const before = Date.now()

  const { session } = await service.login({ email: 'ana@hostly.dev', password: 'x' })

  expect(session.refreshTokenExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 1000)
})
