import { hash } from '@node-rs/argon2'

import type { Prisma } from '../generated/prisma/client.js'
import type { Database } from '../shared/database.js'
import { validCnpj, validCpf } from './documents.js'

/**
 * Factories for integration tests. Each `build*` returns valid create input with unique
 * values (email, CPF, CNPJ…) and each `create*` persists it; pass overrides for whatever
 * the test cares about.
 */

export const TEST_PASSWORD = 'correct horse battery staple'

let sequence = 0
const next = () => ++sequence

let passwordHash: Promise<string> | undefined
/** Hashing is slow on purpose, so every test user shares one hash of TEST_PASSWORD. */
function testPasswordHash() {
  passwordHash ??= hash(TEST_PASSWORD).catch((error: unknown) => {
    // Don't cache a failure: the next call tries again.
    passwordHash = undefined
    throw error
  })
  return passwordHash
}

const DAY_MS = 24 * 60 * 60 * 1000
/** A date-only value `offset` days after 2030-01-01, far from "today" on purpose. */
export function day(offset: number) {
  return new Date(Date.UTC(2030, 0, 1) + offset * DAY_MS)
}

export async function buildUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<Prisma.UserUncheckedCreateInput> {
  const n = next()
  return {
    name: `User ${n}`,
    email: `user${n}@hostly.test`,
    cpf: validCpf(n),
    phone: '48999990000',
    passwordHash: await testPasswordHash(),
    ...overrides,
  }
}

export async function createUser(
  db: Database,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  return db.user.create({ data: await buildUser(overrides) })
}

export function buildProperty(
  overrides: Partial<Prisma.PropertyUncheckedCreateInput> & { userId: string },
): Prisma.PropertyUncheckedCreateInput {
  const n = next()
  return {
    name: `Property ${n}`,
    type: 'HOUSE',
    zipCode: '88000000',
    state: 'SC',
    city: 'Florianópolis',
    ...overrides,
  }
}

export function createProperty(
  db: Database,
  overrides: Partial<Prisma.PropertyUncheckedCreateInput> & { userId: string },
) {
  return db.property.create({ data: buildProperty(overrides) })
}

export function buildBroker(
  overrides: Partial<Prisma.BrokerUncheckedCreateInput> & { userId: string },
): Prisma.BrokerUncheckedCreateInput {
  const n = next()
  return {
    type: 'COMPANY',
    name: `Broker ${n}`,
    email: `broker${n}@hostly.test`,
    document: validCnpj(n),
    ...overrides,
  }
}

export function createBroker(
  db: Database,
  overrides: Partial<Prisma.BrokerUncheckedCreateInput> & { userId: string },
) {
  return db.broker.create({ data: buildBroker(overrides) })
}

export function buildBooking(
  overrides: Partial<Prisma.BookingUncheckedCreateInput> & { userId: string; propertyId: string },
): Prisma.BookingUncheckedCreateInput {
  const n = next()
  // Each default booking gets its own week, so defaults never overlap.
  return {
    guestName: `Guest ${n}`,
    checkIn: day(n * 7),
    checkOut: day(n * 7 + 5),
    nightlyRate: 50_000,
    ...overrides,
  }
}

export function createBooking(
  db: Database,
  overrides: Partial<Prisma.BookingUncheckedCreateInput> & { userId: string; propertyId: string },
) {
  return db.booking.create({ data: buildBooking(overrides) })
}
