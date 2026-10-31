import { describe, expect, it } from 'vitest'

import {
  buildBooking,
  buildBroker,
  buildProperty,
  buildUser,
  createBooking,
  createBroker,
  createProperty,
  createUser,
  day,
} from '../test/factories.js'
import { testDatabase } from '../test/integration/database.js'

/**
 * The database's own integrity rules (unique keys, CHECKs, foreign keys). The API
 * validates the same things; these make sure nothing slips through if it doesn't.
 */

const db = testDatabase()

/** Asserts the write is refused by the named constraint. */
async function expectViolation(write: Promise<unknown>, constraint: string) {
  await expect(write).rejects.toThrow(constraint)
}

async function userWithProperty() {
  const user = await createUser(db)
  const property = await createProperty(db, { userId: user.id })
  return { user, property }
}

describe('users', () => {
  it('stores a valid user with generated id and timestamps', async () => {
    const user = await createUser(db, { email: 'ana@hostly.test' })

    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
  })

  it('refuses a duplicate e-mail', async () => {
    await createUser(db, { email: 'dup@hostly.test' })

    await expectViolation(
      db.user.create({ data: await buildUser({ email: 'dup@hostly.test' }) }),
      'users_email_key',
    )
  })

  it('refuses a duplicate CPF', async () => {
    const existing = await createUser(db)

    await expectViolation(
      db.user.create({ data: await buildUser({ cpf: existing.cpf }) }),
      'users_cpf_key',
    )
  })

  it('refuses an e-mail with uppercase letters', async () => {
    await expectViolation(
      db.user.create({ data: await buildUser({ email: 'Ana@Hostly.test' }) }),
      'users_email_lowercase_check',
    )
  })

  it.each(['529.982.247-25', '5299822472', '5299822472a'])('refuses the CPF %s', async (cpf) => {
    await expectViolation(
      db.user.create({ data: await buildUser({ cpf }) }),
      cpf.length > 11 ? 'too long for the column' : 'users_cpf_format_check',
    )
  })

  it.each(['(48) 99999-0000', '489999', '4899999000a'])('refuses the phone %s', async (phone) => {
    await expectViolation(
      db.user.create({ data: await buildUser({ phone }) }),
      phone.length > 11 ? 'too long for the column' : 'users_phone_format_check',
    )
  })

  it.each(['4833334444', '48999990000'])('accepts the phone %s', async (phone) => {
    await expect(createUser(db, { phone })).resolves.toMatchObject({ phone })
  })
})

describe('properties', () => {
  it('stores an apartment with its apartment fields', async () => {
    const user = await createUser(db)

    const property = await createProperty(db, {
      userId: user.id,
      type: 'APARTMENT',
      building: 'Mar Azul',
      block: 'B',
      unit: '1204',
    })

    expect(property).toMatchObject({ type: 'APARTMENT', building: 'Mar Azul', unit: '1204' })
  })

  it.each([
    ['building', { building: 'Mar Azul' }],
    ['block', { block: 'B' }],
    ['unit', { unit: '101' }],
  ])('refuses a house with an apartment %s', async (_field, fields) => {
    const user = await createUser(db)

    await expectViolation(
      db.property.create({ data: buildProperty({ userId: user.id, type: 'HOUSE', ...fields }) }),
      'properties_apartment_fields_check',
    )
  })

  it('accepts a property without any address', async () => {
    const user = await createUser(db)

    const property = await db.property.create({
      data: { userId: user.id, name: 'Sem endereço', type: 'HOUSE' },
    })

    expect(property).toMatchObject({ zipCode: null, state: null, city: null })
  })

  it.each(['8800000a', '8800000'])('refuses the CEP %s', async (zipCode) => {
    const user = await createUser(db)

    await expectViolation(
      db.property.create({ data: buildProperty({ userId: user.id, zipCode }) }),
      'properties_zip_code_format_check',
    )
  })

  it.each(['sc', 'S1'])('refuses the UF %s', async (state) => {
    const user = await createUser(db)

    await expectViolation(
      db.property.create({ data: buildProperty({ userId: user.id, state }) }),
      'properties_state_format_check',
    )
  })

  it('refuses a property of a user that does not exist', async () => {
    await expectViolation(
      db.property.create({
        data: buildProperty({ userId: '018f0000-0000-7000-8000-000000000000' }),
      }),
      'properties_user_id_fkey',
    )
  })
})

describe('brokers', () => {
  it('stores an individual with a CPF and a company with a CNPJ', async () => {
    const user = await createUser(db)

    const individual = await createBroker(db, {
      userId: user.id,
      type: 'INDIVIDUAL',
      document: '52998224725',
    })
    const company = await createBroker(db, {
      userId: user.id,
      type: 'COMPANY',
      document: '11222333000181',
    })

    expect(individual.document).toBe('52998224725')
    expect(company.document).toBe('11222333000181')
  })

  it('accepts a broker without a document', async () => {
    const user = await createUser(db)

    await expect(
      createBroker(db, { userId: user.id, type: 'INDIVIDUAL', document: null }),
    ).resolves.toMatchObject({ document: null })
  })

  it.each([
    ['an individual with a CNPJ', 'INDIVIDUAL', '11222333000181'],
    ['a company with a CPF', 'COMPANY', '52998224725'],
    ['a document with punctuation', 'INDIVIDUAL', '529.982.247'],
  ] as const)('refuses %s', async (_case, type, document) => {
    const user = await createUser(db)

    await expectViolation(
      db.broker.create({ data: buildBroker({ userId: user.id, type, document }) }),
      'brokers_document_format_check',
    )
  })

  it('refuses an e-mail with uppercase letters', async () => {
    const user = await createUser(db)

    await expectViolation(
      db.broker.create({ data: buildBroker({ userId: user.id, email: 'Imob@Hostly.test' }) }),
      'brokers_email_lowercase_check',
    )
  })

  it.each([
    ['mobile phone', { mobilePhone: '4899999000' }, 'brokers_mobile_phone_format_check'],
    ['landline phone', { landlinePhone: '483333444' }, 'brokers_landline_phone_format_check'],
  ])('refuses a malformed %s', async (_field, phone, constraint) => {
    const user = await createUser(db)

    await expectViolation(
      db.broker.create({ data: buildBroker({ userId: user.id, ...phone }) }),
      constraint,
    )
  })
})

describe('bookings', () => {
  it('stores a booking with its amounts and date-only check-in/out', async () => {
    const { user, property } = await userWithProperty()

    const booking = await createBooking(db, {
      userId: user.id,
      propertyId: property.id,
      checkIn: day(0),
      checkOut: day(5),
      nightlyRate: 45_000,
      cleaningFee: 25_000,
      discount: 10_000,
      amountPaid: 240_000,
    })

    expect(booking.checkIn.toISOString()).toBe('2030-01-01T00:00:00.000Z')
    expect(booking.checkOut.toISOString()).toBe('2030-01-06T00:00:00.000Z')
    expect(booking).toMatchObject({
      nightlyRate: 45_000,
      cleaningFee: 25_000,
      discount: 10_000,
      amountPaid: 240_000,
      brokerCommissionBps: 0,
      brokerId: null,
    })
  })

  it('defaults the optional amounts to zero', async () => {
    const { user, property } = await userWithProperty()

    const booking = await db.booking.create({
      data: {
        userId: user.id,
        propertyId: property.id,
        guestName: 'Guest',
        checkIn: day(0),
        checkOut: day(1),
        nightlyRate: 10_000,
      },
    })

    expect(booking).toMatchObject({ cleaningFee: 0, discount: 0, amountPaid: 0 })
  })

  it.each([
    ['check-out before check-in', day(5), day(1)],
    ['check-out on the check-in day', day(5), day(5)],
  ])('refuses a %s', async (_case, checkIn, checkOut) => {
    const { user, property } = await userWithProperty()

    await expectViolation(
      db.booking.create({
        data: buildBooking({ userId: user.id, propertyId: property.id, checkIn, checkOut }),
      }),
      'bookings_dates_check',
    )
  })

  it.each(['nightlyRate', 'cleaningFee', 'discount', 'amountPaid'])(
    'refuses a negative %s',
    async (field) => {
      const { user, property } = await userWithProperty()

      await expectViolation(
        db.booking.create({
          data: buildBooking({ userId: user.id, propertyId: property.id, [field]: -1 }),
        }),
        'bookings_amounts_check',
      )
    },
  )

  it('accepts a broker commission between 0% and 100%', async () => {
    const { user, property } = await userWithProperty()
    const broker = await createBroker(db, { userId: user.id })

    const full = await createBooking(db, {
      userId: user.id,
      propertyId: property.id,
      brokerId: broker.id,
      brokerCommissionBps: 10_000,
    })

    expect(full.brokerCommissionBps).toBe(10_000)
  })

  it.each([
    ['above 100%', 10_001, true],
    ['negative', -1, true],
    ['without a broker', 500, false],
  ])('refuses a commission %s', async (_case, brokerCommissionBps, withBroker) => {
    const { user, property } = await userWithProperty()
    const broker = withBroker ? await createBroker(db, { userId: user.id }) : null

    await expectViolation(
      db.booking.create({
        data: buildBooking({
          userId: user.id,
          propertyId: property.id,
          brokerId: broker?.id ?? null,
          brokerCommissionBps,
        }),
      }),
      'bookings_broker_commission_check',
    )
  })

  describe('isolation between users', () => {
    it("refuses a booking on another user's property", async () => {
      const owner = await userWithProperty()
      const intruder = await createUser(db)

      await expectViolation(
        db.booking.create({
          data: buildBooking({ userId: intruder.id, propertyId: owner.property.id }),
        }),
        'bookings_property_id_user_id_fkey',
      )
    })

    it("refuses a booking with another user's broker", async () => {
      const { user, property } = await userWithProperty()
      const other = await createUser(db)
      const othersBroker = await createBroker(db, { userId: other.id })

      await expectViolation(
        db.booking.create({
          data: buildBooking({
            userId: user.id,
            propertyId: property.id,
            brokerId: othersBroker.id,
          }),
        }),
        'bookings_broker_id_user_id_fkey',
      )
    })

    it('refuses moving a booking to another user', async () => {
      const { user, property } = await userWithProperty()
      const other = await createUser(db)
      const booking = await createBooking(db, { userId: user.id, propertyId: property.id })

      await expectViolation(
        db.booking.update({ where: { id: booking.id }, data: { userId: other.id } }),
        'bookings_property_id_user_id_fkey',
      )
    })
  })

  describe('deletion', () => {
    it('refuses deleting a property that has bookings', async () => {
      const { user, property } = await userWithProperty()
      await createBooking(db, { userId: user.id, propertyId: property.id })

      await expectViolation(
        db.property.delete({ where: { id: property.id } }),
        'bookings_property_id_user_id_fkey',
      )
    })

    it('refuses deleting a broker that has bookings', async () => {
      const { user, property } = await userWithProperty()
      const broker = await createBroker(db, { userId: user.id })
      await createBooking(db, { userId: user.id, propertyId: property.id, brokerId: broker.id })

      await expectViolation(
        db.broker.delete({ where: { id: broker.id } }),
        'bookings_broker_id_user_id_fkey',
      )
    })

    it('deletes a property or broker once it has no bookings', async () => {
      const { user, property } = await userWithProperty()
      const broker = await createBroker(db, { userId: user.id })
      const booking = await createBooking(db, {
        userId: user.id,
        propertyId: property.id,
        brokerId: broker.id,
      })

      await db.booking.delete({ where: { id: booking.id } })
      await db.property.delete({ where: { id: property.id } })
      await db.broker.delete({ where: { id: broker.id } })

      expect(await db.property.count()).toBe(0)
      expect(await db.broker.count()).toBe(0)
    })

    it("deleting a user removes everything it owns, and nothing of other users'", async () => {
      const { user, property } = await userWithProperty()
      const broker = await createBroker(db, { userId: user.id })
      await createBooking(db, { userId: user.id, propertyId: property.id, brokerId: broker.id })
      const other = await userWithProperty()
      await createBooking(db, { userId: other.user.id, propertyId: other.property.id })

      await db.user.delete({ where: { id: user.id } })

      expect(await db.property.findMany({ select: { userId: true } })).toEqual([
        { userId: other.user.id },
      ])
      expect(await db.broker.count()).toBe(0)
      expect(await db.booking.findMany({ select: { userId: true } })).toEqual([
        { userId: other.user.id },
      ])
    })
  })
})

describe('refresh tokens', () => {
  const tokenHash = 'a'.repeat(64)

  async function newToken(overrides: object = {}) {
    const user = await createUser(db)
    return db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: '018f0000-0000-7000-8000-000000000001',
        expiresAt: day(30),
        ...overrides,
      },
    })
  }

  it('stores an active token without a revocation', async () => {
    await expect(newToken()).resolves.toMatchObject({ revokedAt: null, revokedReason: null })
  })

  it.each([
    ['a revocation date without a reason', { revokedAt: day(1) }],
    ['a reason without a revocation date', { revokedReason: 'LOGOUT' }],
  ])('refuses %s', async (_case, revocation) => {
    await expectViolation(newToken(revocation), 'refresh_tokens_revocation_check')
  })

  it('refuses a hash that is not lowercase hex SHA-256', async () => {
    await expectViolation(
      newToken({ tokenHash: 'Z'.repeat(64) }),
      'refresh_tokens_token_hash_format_check',
    )
  })

  it('refuses the same hash twice', async () => {
    await newToken()

    await expectViolation(newToken(), 'refresh_tokens_token_hash_key')
  })

  it('is deleted with its user', async () => {
    const token = await newToken()

    await db.user.delete({ where: { id: token.userId } })

    expect(await db.refreshToken.count()).toBe(0)
  })
})

describe('alphanumeric CNPJ', () => {
  it('is accepted for a company', async () => {
    const user = await createUser(db)

    await expect(
      createBroker(db, { userId: user.id, type: 'COMPANY', document: '12ABC34501DE35' }),
    ).resolves.toMatchObject({ document: '12ABC34501DE35' })
  })

  it.each([
    ['for an individual', 'INDIVIDUAL', '12ABC34501DE35'],
    ['in lowercase', 'COMPANY', '12abc34501de35'],
    ['with letters in the check digits', 'COMPANY', '12ABC34501DEAB'],
  ] as const)('is refused %s', async (_case, type, document) => {
    const user = await createUser(db)

    await expectViolation(
      db.broker.create({ data: buildBroker({ userId: user.id, type, document }) }),
      'brokers_document_format_check',
    )
  })
})

describe('booking overlap constraint', () => {
  it('refuses two bookings of a property sharing a night, but not back to back', async () => {
    const { user, property } = await userWithProperty()
    const base = { userId: user.id, propertyId: property.id }
    await createBooking(db, { ...base, checkIn: day(0), checkOut: day(5) })

    await expect(
      db.booking.create({ data: buildBooking({ ...base, checkIn: day(4), checkOut: day(8) }) }),
    ).rejects.toThrow('bookings_no_overlap')
    await expect(
      createBooking(db, { ...base, checkIn: day(5), checkOut: day(8) }),
    ).resolves.toBeDefined()
  })

  it('lets two properties have the same nights', async () => {
    const { user, property } = await userWithProperty()
    const other = await createProperty(db, { userId: user.id })

    await createBooking(db, {
      userId: user.id,
      propertyId: property.id,
      checkIn: day(0),
      checkOut: day(5),
    })
    await expect(
      createBooking(db, {
        userId: user.id,
        propertyId: other.id,
        checkIn: day(0),
        checkOut: day(5),
      }),
    ).resolves.toBeDefined()
  })
})
