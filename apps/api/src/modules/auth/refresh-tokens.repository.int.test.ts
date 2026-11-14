import { randomBytes, randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { User } from '../../generated/prisma/client.js'
import { createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'
import { type NewRefreshToken, RefreshTokensRepository } from './refresh-tokens.repository.js'

const db = testDatabase()
/** New tokens whose hash starts with this are the slow ones. */
const SLOW = 'ffffffff'
let repository: RefreshTokensRepository
let user: User

// Holds every new refresh token for a moment before its transaction commits, so a
// revocation can start while a rotation is half done: the window a real race needs.
beforeAll(async () => {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION test_slow_refresh_insert() RETURNS trigger AS $$
    BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END $$ LANGUAGE plpgsql`)
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE TRIGGER test_slow_refresh_insert AFTER INSERT ON refresh_tokens
    FOR EACH ROW WHEN (NEW.token_hash LIKE '${SLOW}%')
    EXECUTE FUNCTION test_slow_refresh_insert()`)
})

afterAll(async () => {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_slow_refresh_insert ON refresh_tokens')
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_slow_refresh_insert')
})

beforeEach(async () => {
  repository = new RefreshTokensRepository(db)
  user = await createUser(db)
})

const DAY = 24 * 60 * 60 * 1000

function token(familyId: string): NewRefreshToken {
  return {
    userId: user.id,
    tokenHash: randomBytes(32).toString('hex'),
    familyId,
    expiresAt: new Date(Date.now() + DAY),
    sessionExpiresAt: new Date(Date.now() + 2 * DAY),
  }
}

const active = (familyId: string) => db.refreshToken.count({ where: { familyId, revokedAt: null } })

/** Rotates `id` slowly and, while that rotation is still open, runs `revoke`. */
async function rotateWhile(id: string, next: NewRefreshToken, revoke: () => Promise<void>) {
  const slow = { ...next, tokenHash: SLOW + next.tokenHash.slice(SLOW.length) }
  const rotation = repository.replace(id, slow, new Date())
  await sleep(100)
  await Promise.all([rotation, revoke()])
}

describe('a rotation racing a revocation', () => {
  it('does not let a session survive "log out the other devices"', async () => {
    const kept = randomUUID()
    await repository.create(token(kept))
    const other = randomUUID()
    const current = await repository.create(token(other))

    await rotateWhile(current.id, token(other), () =>
      repository.revokeAllBut(user.id, kept, new Date(), 'LOGOUT'),
    )

    expect(await active(other)).toBe(0)
    expect(await active(kept)).toBe(1)
  })

  it('does not let a session survive its own logout', async () => {
    const family = randomUUID()
    const current = await repository.create(token(family))

    await rotateWhile(current.id, token(family), () =>
      repository.revokeFamily(family, new Date(), 'LOGOUT'),
    )

    expect(await active(family)).toBe(0)
  })

  it('does nothing for a family with no tokens', async () => {
    await expect(
      repository.revokeFamily(randomUUID(), new Date(), 'LOGOUT'),
    ).resolves.toBeUndefined()
  })
})
