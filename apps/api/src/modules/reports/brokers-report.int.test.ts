import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { Broker, Property, User } from '../../generated/prisma/client.js'
import { parseDate } from '../../shared/dates.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createBroker, createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let ana: User
let casa: Property
let studio: Property
let imob: Broker
let corretor: Broker

interface Report {
  brokers: {
    name: string
    bookings: number
    nights: number
    lodging: number
    averageCommissionBps: number
    fees: number
    items: { guestName: string; checkIn: string; fee: number; commissionBps: number }[]
  }[]
  channels: {
    brokerId: string | null
    name: string | null
    bookings: number
    nights: number
    revenue: number
    brokerFees: number
    net: number
    shareBps: number
  }[]
}

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  ana = await createUser(db)
  casa = await createProperty(db, { userId: ana.id, name: 'Casa' })
  studio = await createProperty(db, { userId: ana.id, name: 'Studio' })
  imob = await createBroker(db, { userId: ana.id, name: 'Imobiliária Mar' })
  corretor = await createBroker(db, { userId: ana.id, name: 'João Corretor' })
  const booking = (data: {
    property?: Property
    broker?: Broker
    guest: string
    checkIn: string
    checkOut: string
    rate: number
    bps?: number
    cleaning?: number
  }) =>
    createBooking(db, {
      userId: ana.id,
      propertyId: (data.property ?? casa).id,
      brokerId: data.broker?.id ?? null,
      guestName: data.guest,
      checkIn: parseDate(data.checkIn),
      checkOut: parseDate(data.checkOut),
      nightlyRate: data.rate,
      brokerCommissionBps: data.bps ?? 0,
      cleaningFee: data.cleaning ?? 0,
    })
  // Checks in during December and leaves in January: its whole fee is December's to pay.
  await booking({
    broker: imob,
    guest: 'Bia',
    checkIn: '2026-12-28',
    checkOut: '2027-01-02',
    rate: 20_000,
    bps: 1_000,
  })
  await booking({
    broker: imob,
    guest: 'Caio',
    checkIn: '2026-12-05',
    checkOut: '2026-12-07',
    rate: 10_000,
    bps: 1_500,
    property: studio,
  })
  await booking({
    broker: corretor,
    guest: 'Davi',
    checkIn: '2026-12-10',
    checkOut: '2026-12-12',
    rate: 10_000,
    bps: 500,
  })
  // Direct, with cleaning.
  await booking({
    guest: 'Eva',
    checkIn: '2026-12-15',
    checkOut: '2026-12-19',
    rate: 10_000,
    cleaning: 10_000,
  })
  // Checked in during November: no fee to pay in December, but its December nights count.
  await booking({
    broker: corretor,
    guest: 'Fábio',
    checkIn: '2026-11-29',
    checkOut: '2026-12-02',
    rate: 30_000,
    bps: 1_000,
  })
})

afterEach(async () => {
  await app.close()
})

function get(query: string, as: User = ana) {
  return app.inject({
    method: 'GET',
    url: `/reports/brokers${query}`,
    headers: authHeader(app, as.id),
  })
}

describe('GET /reports/brokers', () => {
  it('lists what to pay each broker for the bookings checking in, whole fees', async () => {
    const response = await get('?from=2026-12-01&to=2027-01-01')

    expect(response.statusCode).toBe(200)
    const { brokers } = response.json<Report>()
    expect(brokers.map((broker) => [broker.name, broker.bookings, broker.fees])).toEqual([
      ['Imobiliária Mar', 2, 13_000],
      ['João Corretor', 1, 1_000],
    ])
    expect(brokers[0]).toMatchObject({ nights: 7, lodging: 120_000, averageCommissionBps: 1_083 })
    expect(brokers[0]?.items.map((item) => [item.guestName, item.checkIn, item.fee])).toEqual([
      ['Caio', '2026-12-05', 3_000],
      ['Bia', '2026-12-28', 10_000],
    ])
  })

  it('splits the period by channel, nights inside it only', async () => {
    const { channels } = (await get('?from=2026-12-01&to=2027-01-01')).json<Report>()

    // Bia: 4 of her 5 nights are in December; Fábio: 1 of 3. Ties go direct first.
    expect(channels.map((channel) => [channel.name, channel.nights, channel.revenue])).toEqual([
      ['Imobiliária Mar', 6, 100_000],
      [null, 4, 50_000],
      ['João Corretor', 3, 50_000],
    ])
    const direct = channels.find((channel) => channel.brokerId === null)
    expect(direct).toMatchObject({ bookings: 1, brokerFees: 0, net: 50_000, shareBps: 2_500 })
    const joao = channels.find((channel) => channel.name === 'João Corretor')
    expect(joao).toMatchObject({ bookings: 1, brokerFees: 4_000, net: 46_000 })
  })

  it('narrows to one property', async () => {
    const { brokers, channels } = (
      await get(`?from=2026-12-01&to=2027-01-01&propertyId=${studio.id}`)
    ).json<Report>()

    expect(brokers.map((broker) => broker.name)).toEqual(['Imobiliária Mar'])
    expect(channels).toHaveLength(1)
  })

  it('has nothing for a quiet period', async () => {
    expect((await get('?from=2027-03-01&to=2027-04-01')).json()).toMatchObject({
      brokers: [],
      channels: [],
    })
  })

  it("never shows another user's bookings, and 404 for their property", async () => {
    const bia = await createUser(db)
    const hers = await createProperty(db, { userId: bia.id })

    expect((await get('?from=2026-12-01&to=2027-01-01', bia)).json()).toMatchObject({
      brokers: [],
      channels: [],
    })
    const response = await get(`?from=2026-12-01&to=2027-01-01&propertyId=${hers.id}`)
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'PROPERTY_NOT_FOUND' })
  })

  it.each(['', '?from=2026-12-01&to=2026-11-01', '?from=2026-12-01&to=2027-01-01&propertyId=x'])(
    'answers 400 for %s',
    async (query) => {
      expect((await get(query)).statusCode).toBe(400)
    },
  )

  it('answers 401 without a token', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/reports/brokers?from=2026-12-01&to=2027-01-01' }))
        .statusCode,
    ).toBe(401)
  })
})
