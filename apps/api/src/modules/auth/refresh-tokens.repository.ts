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
   * Marks the token as rotated, only if it is still active. Returns false when it was
   * already revoked, so of two concurrent refreshes with the same token only one wins.
   */
  async rotate(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, revokedReason: 'ROTATED' },
    })
    return count === 1
  }

  /** Revokes every still-active token of the family; already revoked ones keep their reason. */
  async revokeFamily(familyId: string, at: Date, reason: RefreshTokenRevocation): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    })
  }
}
