import { verify } from '@node-rs/argon2'
import { describe, expect, it } from 'vitest'

import { createUser } from '../src/test/factories.js'
import { testDatabase } from '../src/test/integration/database.js'
import { SAMPLE_EMAIL, SAMPLE_PASSWORD, seedSampleData } from './sample-data.js'

const db = testDatabase()
const TODAY = new Date('2026-07-15T13:45:00Z')

async function counts() {
  const [users, properties, brokers, bookings] = await Promise.all([
    db.user.count(),
    db.property.count(),
    db.broker.count(),
    db.booking.count(),
  ])
  return { users, properties, brokers, bookings }
}

describe('seedSampleData', () => {
  it('creates the sample user with properties, brokers and bookings', async () => {
    await seedSampleData(db, TODAY)

    expect(await counts()).toEqual({ users: 1, properties: 2, brokers: 2, bookings: 4 })
  })

  it('stores a password that verifies against the documented one', async () => {
    await seedSampleData(db, TODAY)

    const user = await db.user.findUniqueOrThrow({ where: { email: SAMPLE_EMAIL } })
    await expect(verify(user.passwordHash, SAMPLE_PASSWORD)).resolves.toBe(true)
  })

  it('spreads the bookings around today: past, in progress and upcoming', async () => {
    await seedSampleData(db, TODAY)

    const bookings = await db.booking.findMany({ orderBy: { checkIn: 'asc' } })
    const today = new Date('2026-07-15T00:00:00Z')
    expect(bookings.filter((b) => b.checkOut < today)).toHaveLength(1)
    expect(bookings.filter((b) => b.checkIn <= today && b.checkOut > today)).toHaveLength(1)
    expect(bookings.filter((b) => b.checkIn > today)).toHaveLength(2)
  })

  it('is idempotent: running it again leaves the same data', async () => {
    await seedSampleData(db, TODAY)
    await seedSampleData(db, TODAY)

    expect(await counts()).toEqual({ users: 1, properties: 2, brokers: 2, bookings: 4 })
  })

  it("leaves other users' data alone", async () => {
    const other = await createUser(db)

    await seedSampleData(db, TODAY)
    await seedSampleData(db, TODAY)

    expect(await db.user.findUnique({ where: { id: other.id } })).not.toBeNull()
    expect((await counts()).users).toBe(2)
  })
})
