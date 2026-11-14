import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { parseDate } from '../../shared/dates.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createBroker, createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let ana: User

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  ana = await createUser(db)
})

afterEach(async () => {
  await app.close()
})

function get(query: string, as: User = ana) {
  return app.inject({
    method: 'GET',
    url: `/reports/performance${query}`,
    headers: authHeader(app, as.id),
  })
}

describe('GET /reports/performance', () => {
  it('reports every property of the user over the period, with the total', async () => {
    const casa = await createProperty(db, { userId: ana.id, name: 'Casa da Praia' })
    await createProperty(db, { userId: ana.id, name: 'Apartamento Centro' })
    const broker = await createBroker(db, { userId: ana.id })
    // Crosses into December: 2 of its 4 nights count.
    await createBooking(db, {
      userId: ana.id,
      propertyId: casa.id,
      checkIn: parseDate('2026-11-29'),
      checkOut: parseDate('2026-12-03'),
      nightlyRate: 10_000,
      cleaningFee: 8_000,
    })
    await createBooking(db, {
      userId: ana.id,
      propertyId: casa.id,
      brokerId: broker.id,
      checkIn: parseDate('2026-12-10'),
      checkOut: parseDate('2026-12-13'),
      nightlyRate: 20_000,
      cleaningFee: 5_000,
      brokerCommissionBps: 1_000,
    })

    const response = await get('?from=2026-12-01&to=2027-01-01')

    expect(response.statusCode).toBe(200)
    const report = response.json<{
      from: string
      to: string
      days: number
      properties: { name: string; nightsSold: number }[]
      total: Record<string, unknown>
    }>()
    expect(report).toMatchObject({ from: '2026-12-01', to: '2027-01-01', days: 31 })
    expect(report.properties.map((p) => [p.name, p.nightsSold])).toEqual([
      ['Apartamento Centro', 0],
      ['Casa da Praia', 5],
    ])
    expect(report.total).toMatchObject({
      nightsAvailable: 62,
      nightsSold: 5,
      lodging: 80_000,
      cleaning: 5_000,
      revenue: 85_000,
      brokerFees: 6_000,
      net: 79_000,
      averageDailyRate: 16_000,
      bookings: 1,
      averageStay: 3,
    })
  })

  it("never shows another user's properties or bookings", async () => {
    const bia = await createUser(db)
    const hers = await createProperty(db, { userId: bia.id })
    await createBooking(db, {
      userId: bia.id,
      propertyId: hers.id,
      checkIn: parseDate('2026-12-02'),
      checkOut: parseDate('2026-12-05'),
    })

    const report = (await get('?from=2026-12-01&to=2027-01-01')).json<{
      properties: unknown[]
      total: { nightsSold: number }
    }>()

    expect(report.properties).toEqual([])
    expect(report.total.nightsSold).toBe(0)
  })

  it.each([
    ['no dates', ''],
    ['an end before the start', '?from=2026-12-01&to=2026-12-01'],
    ['a bad date', '?from=2026-13-01&to=2027-01-01'],
    ['more than 731 days', '?from=2025-01-01&to=2027-01-03'],
  ])('answers 400 for %s', async (_case, query) => {
    expect((await get(query)).statusCode).toBe(400)
  })

  it('accepts two whole years', async () => {
    expect((await get('?from=2025-01-01&to=2027-01-01')).statusCode).toBe(200)
  })

  it('answers 401 without a token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/reports/performance?from=2026-12-01&to=2027-01-01',
    })

    expect(response.statusCode).toBe(401)
  })
})
