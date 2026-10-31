import type { RefreshToken, RefreshTokenRevocation } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'

export interface NewRefreshToken {
  userId: string
  tokenHash: string
  familyId: string
  expiresAt: Date
}

export class RefreshTokensRepository {
  constructor(private readonly db: Database) {}

  create(data: NewRefreshToken): Promise<RefreshToken> {
    return this.db.refreshToken.create({ data })
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.db.refreshToken.findUnique({ where: { tokenHash } })
  }

  /**
   * Marks `id` as rotated and stores its successor, atomically: either both happen or
   * neither, so a failure can't leave the client holding a rotated token. Returns false
   * (and stores nothing) when `id` was no longer active, e.g. a concurrent refresh won.
   */
  async replace(id: string, next: NewRefreshToken, at: Date): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: at, revokedReason: 'ROTATED' },
      })
      if (count === 0) return false
      await tx.refreshToken.create({ data: next })
      return true
    })
  }

  /** Revokes every still-active token of the family; already revoked ones keep their reason. */
  async revokeFamily(familyId: string, at: Date, reason: RefreshTokenRevocation): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    })
  }

  /** Expired tokens are useless, even for reuse detection; this keeps the table bounded. */
  async deleteExpired(userId: string, now: Date): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId, expiresAt: { lte: now } } })
  }
}
