import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { Property, User } from '../../generated/prisma/client.js'
import { addDays, formatDate, parseDate, today } from '../../shared/dates.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createBroker, createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let owner: User
let other: User
let house: Property

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  owner = await createUser(db)
  other = await createUser(db)
  house = await createProperty(db, { userId: owner.id, name: 'Casa da praia' })
})

afterEach(async () => {
  await app.close()
})

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function request(method: Method, url: string, payload?: object, as: User = owner) {
  return app.inject({ method, url, payload, headers: authHeader(app, as.id) })
}

function book(checkIn: string, checkOut: string, extra: object = {}) {
  return request('POST', '/bookings', {
    propertyId: house.id,
    guestName: 'Mariana Costa',
    checkIn,
    checkOut,
    nightlyRate: 45_000,
    ...extra,
  })
}

/** A date `offset` days from today in São Paulo, as the API decides "today". */
function fromToday(offset: number) {
  return formatDate(addDays(parseDate(today()), offset))
}

describe('authentication', () => {
  it.each([
    ['GET', '/bookings'],
    ['GET', '/bookings/calendar?from=2030-01-01&to=2030-02-01'],
    ['POST', '/bookings'],
    ['GET', '/bookings/018f0000-0000-7000-8000-000000000001'],
    ['PATCH', '/bookings/018f0000-0000-7000-8000-000000000001'],
    ['DELETE', '/bookings/018f0000-0000-7000-8000-000000000001'],
  ] as const)('%s %s answers 401 without a token', async (method, url) => {
    expect((await app.inject({ method, url })).statusCode).toBe(401)
  })
})

describe('POST /bookings', () => {
  it('creates a booking with the property name and the nights', async () => {
    const response = await book('2030-12-20', '2030-12-27', { cleaningFee: 25_000 })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      property: { id: house.id, name: 'Casa da praia' },
      broker: null,
      guestName: 'Mariana Costa',
      checkIn: '2030-12-20',
      checkOut: '2030-12-27',
      nights: 7,
      nightlyRate: 45_000,
      cleaningFee: 25_000,
      discount: 0,
      amountPaid: 0,
      brokerCommissionBps: 0,
      createdAt: expect.any(String) as string,
      updatedAt: expect.any(String) as string,
    })
    const stored = await db.booking.findFirstOrThrow()
    expect(stored.userId).toBe(owner.id)
  })

  it('takes a broker with a commission', async () => {
    const broker = await createBroker(db, { userId: owner.id, name: 'Litoral' })

    const response = await book('2030-12-20', '2030-12-27', {
      brokerId: broker.id,
      brokerCommissionBps: 1000,
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      broker: { id: broker.id, name: 'Litoral' },
      brokerCommissionBps: 1000,
    })
  })

  describe('overlapping dates', () => {
    beforeEach(async () => {
      expect((await book('2030-12-20', '2030-12-27')).statusCode).toBe(201)
    })

    it.each([
      ['the same dates', '2030-12-20', '2030-12-27'],
      ['starting inside', '2030-12-25', '2031-01-02'],
      ['ending inside', '2030-12-15', '2030-12-21'],
      ['inside', '2030-12-22', '2030-12-23'],
      ['around', '2030-12-10', '2031-01-10'],
      ['the last night only', '2030-12-26', '2030-12-27'],
    ])(
      'answers 409 BOOKING_OVERLAP for %s, naming the booking in the way',
      async (_case, checkIn, checkOut) => {
        const response = await book(checkIn, checkOut)

        expect(response.statusCode).toBe(409)
        expect(response.json()).toMatchObject({
          code: 'BOOKING_OVERLAP',
          details: {
            conflictingBookingId: expect.any(String) as string,
            checkIn: '2030-12-20',
            checkOut: '2030-12-27',
          },
        })
        expect(await db.booking.count()).toBe(1)
      },
    )

    it.each([
      ['checking in on the previous check-out day', '2030-12-27', '2031-01-03'],
      ['checking out on the next check-in day', '2030-12-13', '2030-12-20'],
    ])('accepts %s', async (_case, checkIn, checkOut) => {
      expect((await book(checkIn, checkOut)).statusCode).toBe(201)
    })

    it('accepts the same dates on another property', async () => {
      const apartment = await createProperty(db, { userId: owner.id })

      const response = await request('POST', '/bookings', {
        propertyId: apartment.id,
        guestName: 'Outro',
        checkIn: '2030-12-20',
        checkOut: '2030-12-27',
        nightlyRate: 1,
      })

      expect(response.statusCode).toBe(201)
    })
  })

  it('lets exactly one of several simultaneous bookings for the same nights through', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => book('2030-12-20', '2030-12-27', { guestName: `G${i}` })),
    )

    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409, 409, 409, 409])
    expect(await db.booking.count()).toBe(1)
  })

  it("answers 404 PROPERTY_NOT_FOUND for another user's property", async () => {
    const theirs = await createProperty(db, { userId: other.id })

    const response = await request('POST', '/bookings', {
      propertyId: theirs.id,
      guestName: 'X',
      checkIn: '2030-12-20',
      checkOut: '2030-12-27',
      nightlyRate: 1,
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      code: 'PROPERTY_NOT_FOUND',
      details: { field: 'propertyId' },
    })
    expect(await db.booking.count()).toBe(0)
  })

  it("answers 404 BROKER_NOT_FOUND for another user's broker", async () => {
    const theirs = await createBroker(db, { userId: other.id })

    const response = await book('2030-12-20', '2030-12-27', { brokerId: theirs.id })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'BROKER_NOT_FOUND' })
  })

  it.each([
    ['check-out on check-in day', '2030-12-20', '2030-12-20', {}, 'INVALID_DATES'],
    ['check-out before check-in', '2030-12-20', '2030-12-01', {}, 'INVALID_DATES'],
    ['more than a year', '2030-01-01', '2031-01-02', {}, 'INVALID_DATES'],
    [
      'a commission without broker',
      '2030-12-20',
      '2030-12-27',
      { brokerCommissionBps: 500 },
      'COMMISSION_WITHOUT_BROKER',
    ],
  ])('answers 400 for %s', async (_case, checkIn, checkOut, extra, code) => {
    const response = await book(checkIn, checkOut, extra)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code })
  })

  it.each([
    ['a Brazilian date format', { checkIn: '20/12/2030' }, 'checkIn'],
    ['an impossible date', { checkOut: '2030-02-30' }, 'checkOut'],
    ['a negative amount', { discount: -1 }, 'discount'],
    ['an amount with cents as decimals', { nightlyRate: 450.5 }, 'nightlyRate'],
  ])('answers 400 VALIDATION_ERROR for %s', async (_case, extra, path) => {
    const response = await book('2030-12-20', '2030-12-27', extra)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path }] })
  })
})

describe('GET /bookings', () => {
  it('splits upcoming and past around today; checking out today is still upcoming', async () => {
    await createBooking(db, {
      userId: owner.id,
      propertyId: house.id,
      guestName: 'Passada',
      checkIn: parseDate(fromToday(-10)),
      checkOut: parseDate(fromToday(-1)),
    })
    await createBooking(db, {
      userId: owner.id,
      propertyId: house.id,
      guestName: 'Saindo hoje',
      checkIn: parseDate(fromToday(-1)),
      checkOut: parseDate(fromToday(0)),
    })
    await createBooking(db, {
      userId: owner.id,
      propertyId: house.id,
      guestName: 'Em andamento',
      checkIn: parseDate(fromToday(0)),
      checkOut: parseDate(fromToday(3)),
    })
    await createBooking(db, {
      userId: owner.id,
      propertyId: house.id,
      guestName: 'Futura',
      checkIn: parseDate(fromToday(10)),
      checkOut: parseDate(fromToday(12)),
    })
    await createBooking(db, {
      userId: owner.id,
      propertyId: house.id,
      guestName: 'Antiga',
      checkIn: parseDate(fromToday(-40)),
      checkOut: parseDate(fromToday(-30)),
    })

    const upcoming = (await request('GET', '/bookings')).json<{ items: { guestName: string }[] }>()
    const past = (await request('GET', '/bookings?status=past')).json<{
      items: { guestName: string }[]
    }>()

    expect(upcoming.items.map((b) => b.guestName)).toEqual([
      'Saindo hoje',
      'Em andamento',
      'Futura',
    ])
    expect(past.items.map((b) => b.guestName)).toEqual(['Passada', 'Antiga'])
  })

  it('filters by property and searches the guest name literally', async () => {
    const apartment = await createProperty(db, { userId: owner.id })
    await createBooking(db, { userId: owner.id, propertyId: house.id, guestName: 'Mariana Costa' })
    await createBooking(db, {
      userId: owner.id,
      propertyId: apartment.id,
      guestName: 'Mariano Lima',
    })
    await createBooking(db, { userId: owner.id, propertyId: house.id, guestName: 'Pedro 100%' })

    const byProperty = (await request('GET', `/bookings?propertyId=${apartment.id}`)).json<{
      items: { guestName: string }[]
    }>()
    const search = (await request('GET', '/bookings?search=MARIAN')).json<{ total: number }>()
    const percent = (await request('GET', '/bookings?search=%25')).json<{
      items: { guestName: string }[]
    }>()

    expect(byProperty.items.map((b) => b.guestName)).toEqual(['Mariano Lima'])
    expect(search.total).toBe(2)
    expect(percent.items.map((b) => b.guestName)).toEqual(['Pedro 100%'])
  })

  it('lists only my bookings and paginates', async () => {
    for (let i = 0; i < 3; i++) {
      await createBooking(db, { userId: owner.id, propertyId: house.id })
    }
    const theirs = await createProperty(db, { userId: other.id })
    await createBooking(db, { userId: other.id, propertyId: theirs.id })

    const page = (await request('GET', '/bookings?pageSize=2&page=2')).json<{
      items: unknown[]
      total: number
    }>()

    expect(page.items).toHaveLength(1)
    expect(page.total).toBe(3)
  })
})

describe('GET /bookings/calendar', () => {
  async function seedAround() {
    // "Antes" checks out exactly on the window's first day, so it has no night in it.
    // It sits on another property, since it would overlap "Entra antes".
    const apartment = await createProperty(db, { userId: owner.id })
    await createBooking(db, {
      userId: owner.id,
      propertyId: apartment.id,
      guestName: 'Antes',
      checkIn: parseDate('2030-11-20'),
      checkOut: parseDate('2030-12-01'),
    })
    const nights = [
      ['Entra antes', '2030-11-28', '2030-12-03'],
      ['Dentro', '2030-12-10', '2030-12-15'],
      ['Sai depois', '2030-12-29', '2031-01-04'],
      ['Começa no fim', '2031-01-04', '2031-01-06'],
    ] as const
    for (const [guestName, checkIn, checkOut] of nights) {
      await createBooking(db, {
        userId: owner.id,
        propertyId: house.id,
        guestName,
        checkIn: parseDate(checkIn),
        checkOut: parseDate(checkOut),
      })
    }
  }

  it('returns every booking with a night in [from, to), oldest first', async () => {
    await seedAround()

    const response = await request('GET', '/bookings/calendar?from=2030-12-01&to=2031-01-01')

    expect(response.statusCode).toBe(200)
    // "Antes" checks out on Dec 1 (no night in the window); the last one starts after it.
    expect(response.json<{ guestName: string }[]>().map((b) => b.guestName)).toEqual([
      'Entra antes',
      'Dentro',
      'Sai depois',
    ])
  })

  it('treats `to` as exclusive', async () => {
    await seedAround()

    const names = (await request('GET', '/bookings/calendar?from=2031-01-01&to=2031-01-04')).json<
      { guestName: string }[]
    >()

    expect(names.map((b) => b.guestName)).toEqual(['Sai depois'])
  })

  it('filters by property and covers every property otherwise', async () => {
    const apartment = await createProperty(db, { userId: owner.id, name: 'Apê' })
    await createBooking(db, {
      userId: owner.id,
      propertyId: house.id,
      checkIn: parseDate('2030-12-05'),
      checkOut: parseDate('2030-12-08'),
    })
    await createBooking(db, {
      userId: owner.id,
      propertyId: apartment.id,
      checkIn: parseDate('2030-12-05'),
      checkOut: parseDate('2030-12-08'),
    })

    const all = (await request('GET', '/bookings/calendar?from=2030-12-01&to=2031-01-01')).json<
      { property: { name: string } }[]
    >()
    const one = (
      await request(
        'GET',
        `/bookings/calendar?from=2030-12-01&to=2031-01-01&propertyId=${apartment.id}`,
      )
    ).json<unknown[]>()

    expect(all.map((b) => b.property.name).sort()).toEqual(['Apê', 'Casa da praia'])
    expect(one).toHaveLength(1)
  })

  it("never shows another user's bookings", async () => {
    const theirs = await createProperty(db, { userId: other.id })
    await createBooking(db, {
      userId: other.id,
      propertyId: theirs.id,
      checkIn: parseDate('2030-12-05'),
      checkOut: parseDate('2030-12-08'),
    })

    expect(
      (await request('GET', '/bookings/calendar?from=2030-12-01&to=2031-01-01')).json(),
    ).toEqual([])
  })

  it.each([
    ['to before from', 'from=2030-12-10&to=2030-12-01'],
    ['more than 366 days', 'from=2030-01-01&to=2031-01-03'],
    ['no window', ''],
  ])('answers 400 for %s', async (_case, query) => {
    expect((await request('GET', `/bookings/calendar?${query}`)).statusCode).toBe(400)
  })
})

describe('GET /bookings/:id', () => {
  it('answers my booking', async () => {
    const id = (await book('2030-12-20', '2030-12-27')).json<{ id: string }>().id

    const response = await request('GET', `/bookings/${id}`)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id, nights: 7, property: { name: 'Casa da praia' } })
  })

  it("answers 404 BOOKING_NOT_FOUND for another user's booking", async () => {
    const theirs = await createProperty(db, { userId: other.id })
    const booking = await createBooking(db, { userId: other.id, propertyId: theirs.id })

    const response = await request('GET', `/bookings/${booking.id}`)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'BOOKING_NOT_FOUND' })
  })
})

describe('PATCH /bookings/:id', () => {
  async function created(checkIn = '2030-12-20', checkOut = '2030-12-27', extra: object = {}) {
    return (await book(checkIn, checkOut, extra)).json<{ id: string }>().id
  }

  it('moves the dates, even onto nights the same booking already had', async () => {
    const id = await created()

    const response = await request('PATCH', `/bookings/${id}`, {
      checkIn: '2030-12-22',
      checkOut: '2030-12-30',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      checkIn: '2030-12-22',
      checkOut: '2030-12-30',
      nights: 8,
    })
  })

  it('answers 409 BOOKING_OVERLAP when moved onto another booking, naming it', async () => {
    const first = await created('2030-12-20', '2030-12-27')
    const second = await created('2031-01-05', '2031-01-10')

    const response = await request('PATCH', `/bookings/${second}`, { checkIn: '2030-12-26' })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      code: 'BOOKING_OVERLAP',
      details: { conflictingBookingId: first },
    })
    expect(
      formatDate((await db.booking.findUniqueOrThrow({ where: { id: second } })).checkIn),
    ).toBe('2031-01-05')
  })

  it('answers 400 INVALID_DATES when only check-out moves before the stored check-in', async () => {
    const id = await created()

    const response = await request('PATCH', `/bookings/${id}`, { checkOut: '2030-12-19' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_DATES' })
  })

  it('moves the booking to another of my properties', async () => {
    const apartment = await createProperty(db, { userId: owner.id, name: 'Apê' })
    const id = await created()

    const response = await request('PATCH', `/bookings/${id}`, { propertyId: apartment.id })

    expect(response.json()).toMatchObject({ property: { id: apartment.id, name: 'Apê' } })
  })

  it("answers 404 PROPERTY_NOT_FOUND when moved to another user's property", async () => {
    const theirs = await createProperty(db, { userId: other.id })
    const id = await created()

    const response = await request('PATCH', `/bookings/${id}`, { propertyId: theirs.id })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'PROPERTY_NOT_FOUND' })
  })

  it('drops the commission when the broker is removed', async () => {
    const broker = await createBroker(db, { userId: owner.id })
    const id = await created('2030-12-20', '2030-12-27', {
      brokerId: broker.id,
      brokerCommissionBps: 1000,
    })

    const response = await request('PATCH', `/bookings/${id}`, { brokerId: null })

    expect(response.json()).toMatchObject({ broker: null, brokerCommissionBps: 0 })
  })

  it("answers 404 for another user's booking and leaves it alone", async () => {
    const theirs = await createProperty(db, { userId: other.id })
    const booking = await createBooking(db, {
      userId: other.id,
      propertyId: theirs.id,
      guestName: 'Deles',
    })

    expect((await request('PATCH', `/bookings/${booking.id}`, { guestName: 'X' })).statusCode).toBe(
      404,
    )
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).guestName).toBe(
      'Deles',
    )
  })
})

describe('DELETE /bookings/:id', () => {
  it('deletes, which frees the dates and lets the property be deleted', async () => {
    const id = (await book('2030-12-20', '2030-12-27')).json<{ id: string }>().id

    expect((await request('DELETE', `/bookings/${id}`)).statusCode).toBe(204)
    expect((await book('2030-12-20', '2030-12-27')).statusCode).toBe(201)
  })

  it("answers 404 for another user's booking and keeps it", async () => {
    const theirs = await createProperty(db, { userId: other.id })
    const booking = await createBooking(db, { userId: other.id, propertyId: theirs.id })

    expect((await request('DELETE', `/bookings/${booking.id}`)).statusCode).toBe(404)
    expect(await db.booking.count()).toBe(1)
  })
})

it('documents the routes', async () => {
  const paths = (await app.inject({ method: 'GET', url: '/docs/json' })).json<{
    paths: Record<string, object>
  }>().paths

  expect(Object.keys(paths['/bookings/'] ?? paths['/bookings'] ?? {})).toEqual(['get', 'post'])
  expect(Object.keys(paths['/bookings/calendar'] ?? {})).toEqual(['get'])
  expect(Object.keys(paths['/bookings/{id}'] ?? {})).toEqual(['get', 'patch', 'delete'])
})
