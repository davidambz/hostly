import { randomUUID } from 'node:crypto'

import type { User } from '../../generated/prisma/client.js'
import { UniqueFieldError } from '../../shared/database-errors.js'
import { ConflictError, UnauthorizedError } from '../../shared/errors.js'
import type { UserUniqueField, UsersRepository } from '../users/users.repository.js'
import type { LoginInput, RegisterInput } from './auth.schemas.js'
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js'
import type { RefreshTokensRepository } from './refresh-tokens.repository.js'

export interface AuthServiceDeps {
  users: Pick<UsersRepository, 'create' | 'takenFields' | 'findByEmail'>
  refreshTokens: Pick<RefreshTokensRepository, 'create' | 'findByHash' | 'rotate' | 'revokeFamily'>
  hashPassword: (password: string) => Promise<string>
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>
  signAccessToken: (userId: string) => string
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

export class AuthService {
  private readonly now: () => Date
  /** Verified against when the e-mail is unknown, so both cases take as long. */
  private dummyHash?: Promise<string>

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date())
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
      this.dummyHash ??= this.deps.hashPassword('not a real password')
      await this.deps.verifyPassword(await this.dummyHash, password)
      throw invalidCredentials()
    }
    if (!(await this.deps.verifyPassword(user.passwordHash, password))) {
      throw invalidCredentials()
    }
    return { user, session: await this.issueSession(user.id, randomUUID()) }
  }

  /**
   * Trades a refresh token for a new access token and a new refresh token (rotation).
   * A token that was already rotated means it leaked: its whole family is revoked, which
   * logs out both the attacker and the user. A token revoked any other way (logout, a
   * previous reuse) is simply no longer valid.
   */
  async refresh(token: string): Promise<Session> {
    const stored = await this.deps.refreshTokens.findByHash(hashRefreshToken(token))
    if (!stored) {
      throw invalidRefreshToken()
    }
    const now = this.now()

    if (stored.revokedReason === 'ROTATED') {
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
    // A concurrent refresh with the same token got here first.
    if (!(await this.deps.refreshTokens.rotate(stored.id, now))) {
      throw invalidRefreshToken()
    }

    return this.issueSession(stored.userId, stored.familyId)
  }

  /** Ends the session the token belongs to. Unknown or missing tokens are fine. */
  async logout(token: string | undefined): Promise<void> {
    if (!token) return
    const stored = await this.deps.refreshTokens.findByHash(hashRefreshToken(token))
    if (stored) {
      await this.deps.refreshTokens.revokeFamily(stored.familyId, this.now(), 'LOGOUT')
    }
  }

  private async issueSession(userId: string, familyId: string): Promise<Session> {
    const refreshToken = generateRefreshToken()
    const refreshTokenExpiresAt = new Date(this.now().getTime() + this.deps.refreshTokenTtlMs)
    await this.deps.refreshTokens.create({
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    })
    return {
      accessToken: this.deps.signAccessToken(userId),
      refreshToken,
      refreshTokenExpiresAt,
    }
  }
}
