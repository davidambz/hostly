import { randomUUID } from 'node:crypto'

import type { User } from '../../generated/prisma/client.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { ConflictError, UnauthorizedError } from '../../shared/errors.js'
import type { UserUniqueField, UsersRepository } from '../users/users.repository.js'
import type { LoginInput, RegisterInput } from './auth.schemas.js'
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js'
import type { NewRefreshToken, RefreshTokensRepository } from './refresh-tokens.repository.js'

/**
 * How long after a rotation the old token is still recognized as "just rotated" rather
 * than stolen: two tabs or a retried request refreshing with the same cookie land here.
 */
export const ROTATION_GRACE_MS = 30_000

export interface AuthServiceDeps {
  users: Pick<UsersRepository, 'create' | 'takenFields' | 'findByEmail'>
  refreshTokens: Pick<
    RefreshTokensRepository,
    'create' | 'findByHash' | 'replace' | 'revokeFamily' | 'deleteExpired'
  >
  hashPassword: (password: string) => Promise<string>
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>
  signAccessToken: (userId: string) => string
  /** How long a login lasts. Fixed at login: refreshing doesn't extend it. */
  refreshTokenTtlMs: number
  now?: () => Date
}

/** What a login or refresh hands back: tokens for the client and the refresh expiry. */
export interface Session {
  accessToken: string
  refreshToken: string
  refreshTokenExpiresAt: Date
}

const TAKEN: Record<UserUniqueField, { code: string; message: string }> = {
  email: { code: 'EMAIL_TAKEN', message: 'E-mail already registered' },
  cpf: { code: 'CPF_TAKEN', message: 'CPF already registered' },
}

function takenError(field: UserUniqueField) {
  const { code, message } = TAKEN[field]
  return new ConflictError(message, { code, details: { field } })
}

const invalidCredentials = () =>
  new UnauthorizedError('Invalid e-mail or password', { code: 'INVALID_CREDENTIALS' })

const invalidRefreshToken = () =>
  new UnauthorizedError('Invalid refresh token', { code: 'INVALID_REFRESH_TOKEN' })

/** Retryable: the token was just rotated by a concurrent request, whose new cookie wins. */
const justRotated = () =>
  new UnauthorizedError('Refresh token was just rotated; retry with the new one', {
    code: 'REFRESH_TOKEN_ROTATED',
  })

export class AuthService {
  private readonly now: () => Date
  /** Verified against when the e-mail is unknown, so both cases take as long. */
  private dummyHash?: Promise<string>

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date())
    // Computed up front, so not even the first unknown-e-mail login is slower.
    this.getDummyHash().catch(() => undefined)
  }

  /** Creates the account; throws ConflictError (EMAIL_TAKEN / CPF_TAKEN) if either is in use. */
  async register({ password, ...profile }: RegisterInput): Promise<User> {
    // Checked before hashing, so a taken e-mail or CPF doesn't cost an argon2 run.
    const [taken] = await this.deps.users.takenFields(profile)
    if (taken) {
      throw takenError(taken)
    }

    const passwordHash = await this.deps.hashPassword(password)
    try {
      return await this.deps.users.create({ ...profile, passwordHash })
    } catch (error) {
      // Someone else took it between the check and the insert.
      if (error instanceof UniqueFieldError) {
        throw takenError(error.field as UserUniqueField)
      }
      throw error
    }
  }

  /**
   * Starts a session. A wrong password and an unknown e-mail give the same error and
   * take the same time, so the answer doesn't reveal which accounts exist.
   */
  async login({ email, password }: LoginInput): Promise<{ user: User; session: Session }> {
    const user = await this.deps.users.findByEmail(email)
    if (!user) {
      await this.deps.verifyPassword(await this.getDummyHash(), password)
      throw invalidCredentials()
    }
    if (!(await this.deps.verifyPassword(user.passwordHash, password))) {
      throw invalidCredentials()
    }

    const now = this.now()
    await this.deps.refreshTokens.deleteExpired(user.id, now)
    const next = this.newRefreshToken(
      user.id,
      randomUUID(),
      now.getTime() + this.deps.refreshTokenTtlMs,
    )
    await this.deps.refreshTokens.create(next.record)
    return { user, session: this.session(user.id, next) }
  }

  /**
   * Trades a refresh token for a new access token and a new refresh token (rotation).
   * Presenting a token rotated more than ROTATION_GRACE_MS ago means it leaked: the whole
   * family is revoked, logging out both the attacker and the user. A token revoked any
   * other way (logout, a previous reuse) is simply no longer valid.
   */
  async refresh(token: string | undefined): Promise<Session> {
    if (!token) {
      throw invalidRefreshToken()
    }
    const stored = await this.deps.refreshTokens.findByHash(hashRefreshToken(token))
    if (!stored) {
      throw invalidRefreshToken()
    }
    const now = this.now()

    if (stored.revokedReason === 'ROTATED' && stored.revokedAt) {
      if (now.getTime() - stored.revokedAt.getTime() <= ROTATION_GRACE_MS) {
        throw justRotated()
      }
      await this.deps.refreshTokens.revokeFamily(stored.familyId, now, 'REUSE_DETECTED')
      throw new UnauthorizedError('Refresh token reused; session revoked', {
        code: 'REFRESH_TOKEN_REUSED',
      })
    }
    if (stored.revokedAt) {
      throw invalidRefreshToken()
    }
    if (stored.expiresAt <= now) {
      throw new UnauthorizedError('Refresh token expired', { code: 'REFRESH_TOKEN_EXPIRED' })
    }

    // The successor keeps the login's expiry, so a session can't be stretched forever.
    const next = this.newRefreshToken(stored.userId, stored.familyId, stored.expiresAt.getTime())
    if (!(await this.deps.refreshTokens.replace(stored.id, next.record, now))) {
      // A concurrent refresh with the same token got there first.
      throw justRotated()
    }
    return this.session(stored.userId, next)
  }

  /** Ends the session the token belongs to. Unknown or missing tokens are fine. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return
    const stored = await this.deps.refreshTokens.findByHash(hashRefreshToken(token))
    if (stored) {
      await this.deps.refreshTokens.revokeFamily(stored.familyId, this.now(), 'LOGOUT')
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hashPassword('not a real password').catch((error: unknown) => {
      // Don't cache a failure: the next unknown-e-mail login tries again.
      this.dummyHash = undefined
      throw error
    })
    return this.dummyHash
  }

  private newRefreshToken(userId: string, familyId: string, expiresAtMs: number) {
    const token = generateRefreshToken()
    const record: NewRefreshToken = {
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(expiresAtMs),
    }
    return { token, record }
  }

  private session(userId: string, next: { token: string; record: NewRefreshToken }): Session {
    return {
      accessToken: this.deps.signAccessToken(userId),
      refreshToken: next.token,
      refreshTokenExpiresAt: next.record.expiresAt,
    }
  }
}
