import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { Property, User } from '../../generated/prisma/client.js'
import { today } from '../../shared/dates.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createProperty, createUser } from '../../test/factories.js'
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

/** 7 nights at R$ 450 plus R$ 250 cleaning: R$ 3.400 in total. */
async function booking(extra: object = {}) {
  const response = await request('POST', '/bookings', {
    propertyId: house.id,
    guestName: 'Mariana Costa',
    checkIn: '2030-12-20',
    checkOut: '2030-12-27',
    nightlyRate: 45_000,
    cleaningFee: 25_000,
    ...extra,
  })
  return response.json<{ id: string; amountPaid: number }>()
}

async function bookingNow(id: string) {
  return (await request('GET', `/bookings/${id}`)).json<{
    amountPaid: number
    financials: { balanceDue: number }
  }>()
}

describe('payments', () => {
  it('records the deposit of a new booking as its first payment, today', async () => {
    const { id } = await booking({ amountPaid: 100_000 })

    const response = await request('GET', `/bookings/${id}/payments`)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
        amount: 100_000,
        paidOn: today(),
        note: 'Sinal',
        createdAt: expect.any(String) as string,
      },
    ])
  })

  it('has none for a booking created with nothing paid', async () => {
    const { id } = await booking()

    expect((await request('GET', `/bookings/${id}/payments`)).json()).toEqual([])
  })

  it('adds a payment to what was paid, and lists them by day', async () => {
    const { id } = await booking({ amountPaid: 100_000 })

    const created = await request('POST', `/bookings/${id}/payments`, {
      amount: 50_000,
      paidOn: '2030-12-01',
      note: '  Pix  ',
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ amount: 50_000, paidOn: '2030-12-01', note: 'Pix' })
    expect(await bookingNow(id)).toMatchObject({
      amountPaid: 150_000,
      financials: { balanceDue: 190_000 },
    })
    const list = (await request('GET', `/bookings/${id}/payments`)).json<{ amount: number }[]>()
    expect(list.map((payment) => payment.amount)).toEqual([100_000, 50_000])
  })

  it('settles the booking with a payment of exactly what is due', async () => {
    const { id } = await booking()

    const response = await request('POST', `/bookings/${id}/payments`, {
      amount: 340_000,
      paidOn: '2030-12-20',
    })

    expect(response.statusCode).toBe(201)
    expect(await bookingNow(id)).toMatchObject({ financials: { balanceDue: 0 } })
  })

  it('answers 400 PAYMENT_EXCEEDS_BALANCE for more than what is due, and records nothing', async () => {
    const { id } = await booking({ amountPaid: 300_000 })

    const response = await request('POST', `/bookings/${id}/payments`, {
      amount: 40_001,
      paidOn: '2030-12-20',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      details: { field: 'amount' },
    })
    expect((await bookingNow(id)).amountPaid).toBe(300_000)
    expect(await db.payment.count()).toBe(1)
  })

  it.each([
    ['a zero amount', { amount: 0, paidOn: '2030-12-20' }],
    ['an amount in reais', { amount: 10.5, paidOn: '2030-12-20' }],
    ['no day', { amount: 100 }],
    ['an invalid day', { amount: 100, paidOn: '2030-02-30' }],
  ])('answers 400 for %s', async (_case, payload) => {
    const { id } = await booking()

    expect((await request('POST', `/bookings/${id}/payments`, payload)).statusCode).toBe(400)
  })

  it('deletes a payment, taking it off what was paid', async () => {
    const { id } = await booking({ amountPaid: 100_000 })
    const [deposit] = (await request('GET', `/bookings/${id}/payments`)).json<{ id: string }[]>()

    const response = await request('DELETE', `/bookings/${id}/payments/${deposit?.id ?? ''}`)

    expect(response.statusCode).toBe(204)
    expect((await bookingNow(id)).amountPaid).toBe(0)
    expect((await request('GET', `/bookings/${id}/payments`)).json()).toEqual([])
  })

  it('answers 404 PAYMENT_NOT_FOUND for a payment that is not there', async () => {
    const { id } = await booking()

    const response = await request(
      'DELETE',
      `/bookings/${id}/payments/018f0000-0000-7000-8000-000000000009`,
    )

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'PAYMENT_NOT_FOUND' })
  })

  it("keeps each user's payments apart: another user's booking is 404", async () => {
    const { id } = await booking({ amountPaid: 100_000 })
    const [deposit] = (await request('GET', `/bookings/${id}/payments`)).json<{ id: string }[]>()

    const list = await request('GET', `/bookings/${id}/payments`, undefined, other)
    const add = await request(
      'POST',
      `/bookings/${id}/payments`,
      { amount: 100, paidOn: '2030-12-20' },
      other,
    )
    const remove = await request(
      'DELETE',
      `/bookings/${id}/payments/${deposit?.id ?? ''}`,
      undefined,
      other,
    )

    for (const response of [list, add, remove]) {
      expect(response.statusCode).toBe(404)
      expect(response.json()).toMatchObject({ code: 'BOOKING_NOT_FOUND' })
    }
    expect((await bookingNow(id)).amountPaid).toBe(100_000)
  })

  it('no longer changes what was paid through a booking update', async () => {
    const { id } = await booking({ amountPaid: 100_000 })

    const response = await request('PATCH', `/bookings/${id}`, { amountPaid: 0, guestName: 'Ana' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ guestName: 'Ana', amountPaid: 100_000 })
  })

  it('goes away with its booking', async () => {
    const { id } = await booking({ amountPaid: 100_000 })

    await request('DELETE', `/bookings/${id}`)

    expect(await db.payment.count()).toBe(0)
  })

  it('refuses, in the database, a payment of zero', async () => {
    const { id } = await booking()

    await expect(
      db.payment.create({
        data: { userId: owner.id, bookingId: id, amount: 0, paidOn: new Date() },
      }),
    ).rejects.toThrow()
  })

  it.each([
    ['GET', '/bookings/018f0000-0000-7000-8000-000000000001/payments'],
    ['POST', '/bookings/018f0000-0000-7000-8000-000000000001/payments'],
    [
      'DELETE',
      '/bookings/018f0000-0000-7000-8000-000000000001/payments/018f0000-0000-7000-8000-000000000002',
    ],
  ] as const)('%s %s answers 401 without a token', async (method, url) => {
    expect((await app.inject({ method, url })).statusCode).toBe(401)
  })
})
