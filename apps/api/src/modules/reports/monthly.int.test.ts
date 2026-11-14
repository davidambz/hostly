import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { Property, User } from '../../generated/prisma/client.js'
import { parseDate } from '../../shared/dates.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let ana: User
let casa: Property
let studio: Property

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  ana = await createUser(db)
  casa = await createProperty(db, { userId: ana.id, name: 'Casa' })
  studio = await createProperty(db, { userId: ana.id, name: 'Studio' })
  // New Year's: 3 nights in December 2026, 2 in January 2027.
  await createBooking(db, {
    userId: ana.id,
    propertyId: casa.id,
    checkIn: parseDate('2026-12-29'),
    checkOut: parseDate('2027-01-03'),
    nightlyRate: 30_000,
  })
  await createBooking(db, {
    userId: ana.id,
    propertyId: studio.id,
    checkIn: parseDate('2026-07-10'),
    checkOut: parseDate('2026-07-12'),
    nightlyRate: 10_000,
  })
})

afterEach(async () => {
  await app.close()
})

interface Monthly {
  year: number
  months: { month: string; nightsSold: number; lodging: number; nightsAvailable: number }[]
  total: { nightsSold: number; lodging: number; nightsAvailable: number }
}

function get(query: string, as: User = ana) {
  return app.inject({
    method: 'GET',
    url: `/reports/monthly${query}`,
    headers: authHeader(app, as.id),
  })
}

describe('GET /reports/monthly', () => {
  it('gives the twelve months and the year, for all properties', async () => {
    const response = await get('?year=2026')

    expect(response.statusCode).toBe(200)
    const report = response.json<Monthly>()
    expect(report.months.map((month) => month.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ])
    expect(report.months[6]).toMatchObject({ nightsSold: 2, lodging: 20_000, nightsAvailable: 62 })
    expect(report.months[11]).toMatchObject({ nightsSold: 3, lodging: 90_000 })
    expect(report.total).toMatchObject({ nightsSold: 5, lodging: 110_000, nightsAvailable: 730 })
  })

  it('splits a stay across the years', async () => {
    const next = (await get('?year=2027')).json<Monthly>()

    expect(next.months[0]).toMatchObject({ nightsSold: 2, lodging: 60_000 })
    expect(next.total.lodging).toBe(60_000)
  })

  it('narrows to one property', async () => {
    const report = (await get(`?year=2026&propertyId=${studio.id}`)).json<Monthly>()

    expect(report.total).toMatchObject({ nightsSold: 2, nightsAvailable: 365 })
  })

  it("answers 404 PROPERTY_NOT_FOUND for another user's property", async () => {
    const bia = await createUser(db)
    const hers = await createProperty(db, { userId: bia.id })

    const response = await get(`?year=2026&propertyId=${hers.id}`)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'PROPERTY_NOT_FOUND' })
  })

  it.each(['', '?year=1999', '?year=dois', '?year=2026&propertyId=x'])(
    'answers 400 for %s',
    async (query) => {
      expect((await get(query)).statusCode).toBe(400)
    },
  )

  it('answers 401 without a token', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/reports/monthly?year=2026' })).statusCode,
    ).toBe(401)
  })
})
