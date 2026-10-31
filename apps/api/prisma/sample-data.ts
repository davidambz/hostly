/**
 * Sample data for local development: one user with properties, brokers and bookings
 * in the past, in progress and in the future. Safe to run repeatedly: the sample
 * user and everything it owns are recreated each time.
 */
import { hash } from '@node-rs/argon2'

import type { Database } from '../src/shared/database.js'

export const SAMPLE_EMAIL = 'ana@hostly.dev'
export const SAMPLE_PASSWORD = 'hostly123'

const DAY_MS = 24 * 60 * 60 * 1000

/** Recreates the sample user and its data, with booking dates relative to `today`. */
export async function seedSampleData(db: Database, today = new Date()) {
  /** A date-only value `offset` days from `today` (UTC midnight, as Postgres `date` expects). */
  const daysFromToday = (offset: number) =>
    new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + offset * DAY_MS,
    )

  await db.$transaction(async (tx) => {
    // Cascades to the user's properties, brokers and bookings.
    await tx.user.deleteMany({ where: { email: SAMPLE_EMAIL } })

    const user = await tx.user.create({
      data: {
        name: 'Ana Souza',
        email: SAMPLE_EMAIL,
        cpf: '52998224725',
        phone: '48999887766',
        passwordHash: await hash(SAMPLE_PASSWORD),
      },
    })

    const beachHouse = await tx.property.create({
      data: {
        userId: user.id,
        name: 'Casa da praia',
        type: 'HOUSE',
        zipCode: '88053700',
        state: 'SC',
        city: 'Florianópolis',
        neighborhood: 'Jurerê',
        street: 'Avenida dos Búzios',
        number: '1200',
      },
    })

    const apartment = await tx.property.create({
      data: {
        userId: user.id,
        name: 'Apê Centro',
        type: 'APARTMENT',
        zipCode: '88330000',
        state: 'SC',
        city: 'Balneário Camboriú',
        neighborhood: 'Centro',
        street: 'Avenida Atlântica',
        number: '3500',
        building: 'Edifício Mar Azul',
        block: 'B',
        unit: '1204',
      },
    })

    const agency = await tx.broker.create({
      data: {
        userId: user.id,
        type: 'COMPANY',
        name: 'Litoral Imóveis',
        email: 'contato@litoralimoveis.com.br',
        document: '11222333000181',
        mobilePhone: '48988776655',
        landlinePhone: '4833221100',
      },
    })

    const agent = await tx.broker.create({
      data: {
        userId: user.id,
        type: 'INDIVIDUAL',
        name: 'Carlos Lima',
        document: '11144477735',
        mobilePhone: '47991234567',
      },
    })

    await tx.booking.createMany({
      data: [
        {
          userId: user.id,
          propertyId: beachHouse.id,
          brokerId: agency.id,
          guestName: 'Mariana Costa',
          checkIn: daysFromToday(-30),
          checkOut: daysFromToday(-25),
          nightlyRate: 45_000,
          cleaningFee: 25_000,
          discount: 10_000,
          amountPaid: 240_000,
          brokerCommissionBps: 1000,
        },
        {
          userId: user.id,
          propertyId: beachHouse.id,
          guestName: 'Rafael Mendes',
          checkIn: daysFromToday(-2),
          checkOut: daysFromToday(3),
          nightlyRate: 50_000,
          cleaningFee: 25_000,
          amountPaid: 100_000,
        },
        {
          userId: user.id,
          propertyId: beachHouse.id,
          brokerId: agent.id,
          guestName: 'Juliana Prado',
          checkIn: daysFromToday(20),
          checkOut: daysFromToday(27),
          nightlyRate: 55_000,
          cleaningFee: 25_000,
          discount: 20_000,
          brokerCommissionBps: 800,
        },
        {
          userId: user.id,
          propertyId: apartment.id,
          guestName: 'Pedro Alves',
          checkIn: daysFromToday(5),
          checkOut: daysFromToday(9),
          nightlyRate: 32_000,
          cleaningFee: 15_000,
          amountPaid: 64_000,
        },
      ],
    })
  })
}
