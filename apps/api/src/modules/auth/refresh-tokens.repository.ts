import type { RefreshToken, RefreshTokenRevocation } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'

type Transaction = Parameters<Parameters<Database['$transaction']>[0]>[0]

/**
 * Locks the user's row for the rest of the transaction. Rotations and revocations of the
 * same user take this lock first, so they run one after the other: without it, a refresh
 * could store its new token after a revocation had already swept the table (READ COMMITTED
 * doesn't see rows inserted after the UPDATE began), and that session would escape a
 * logout, a password change or a reuse detection.
 */
async function lockUser(tx: Transaction, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
}

export interface NewRefreshToken {
  userId: string
  tokenHash: string
  familyId: string
  expiresAt: Date
  sessionExpiresAt: Date
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
      await lockUser(tx, next.userId)
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
    await this.db.$transaction(async (tx) => {
      const token = await tx.refreshToken.findFirst({
        where: { familyId },
        select: { userId: true },
      })
      if (!token) return
      await lockUser(tx, token.userId)
      await tx.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: at, revokedReason: reason },
      })
    })
  }

  /** Revokes every active token of the user but the family `keep` (the current session). */
  async revokeAllBut(
    userId: string,
    keep: string | null,
    at: Date,
    reason: RefreshTokenRevocation,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await lockUser(tx, userId)
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null, ...(keep ? { familyId: { not: keep } } : {}) },
        data: { revokedAt: at, revokedReason: reason },
      })
    })
  }

  /** Expired tokens are useless, even for reuse detection; this keeps the table bounded. */
  async deleteExpired(userId: string, now: Date): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId, expiresAt: { lte: now } } })
  }
}
