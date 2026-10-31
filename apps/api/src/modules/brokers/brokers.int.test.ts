import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createBroker, createProperty, createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let owner: User
let other: User

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
  owner = await createUser(db)
  other = await createUser(db)
})

afterEach(async () => {
  await app.close()
})

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function request(method: Method, url: string, payload?: object, as: User = owner) {
  return app.inject({ method, url, payload, headers: authHeader(app, as.id) })
}

const company = {
  type: 'COMPANY',
  name: 'Litoral Imóveis',
  email: 'Contato@Litoral.COM',
  document: '12.ABC.345/01DE-35',
  mobilePhone: '(48) 98877-6655',
  landlinePhone: '(48) 3322-1100',
}
const individual = { type: 'INDIVIDUAL', name: 'Carlos Lima', document: '529.982.247-25' }

describe('authentication', () => {
  it.each([
    ['GET', '/brokers'],
    ['POST', '/brokers'],
    ['GET', '/brokers/018f0000-0000-7000-8000-000000000001'],
    ['PATCH', '/brokers/018f0000-0000-7000-8000-000000000001'],
    ['DELETE', '/brokers/018f0000-0000-7000-8000-000000000001'],
  ] as const)('%s %s answers 401 without a token', async (method, url) => {
    const response = await app.inject({
      method,
      url,
      payload: method === 'POST' ? company : undefined,
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /brokers', () => {
  it('creates a company with an alphanumeric CNPJ, normalizing everything', async () => {
    const response = await request('POST', '/brokers', company)

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      type: 'COMPANY',
      name: 'Litoral Imóveis',
      email: 'contato@litoral.com',
      document: '12ABC34501DE35',
      mobilePhone: '48988776655',
      landlinePhone: '4833221100',
      createdAt: expect.any(String) as string,
      updatedAt: expect.any(String) as string,
    })
    expect((await db.broker.findFirstOrThrow()).userId).toBe(owner.id)
  })

  it('creates a company with a numeric CNPJ', async () => {
    const response = await request('POST', '/brokers', {
      ...company,
      document: '11.222.333/0001-81',
    })

    expect(response.json()).toMatchObject({ document: '11222333000181' })
  })

  it('creates an individual with a CPF and nothing else', async () => {
    const response = await request('POST', '/brokers', individual)

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      type: 'INDIVIDUAL',
      document: '52998224725',
      email: null,
      mobilePhone: null,
      landlinePhone: null,
    })
  })

  it.each([
    [
      'a landline in the mobile field',
      { ...company, mobilePhone: '(48) 3322-1100' },
      'mobilePhone',
    ],
    [
      'a mobile in the landline field',
      { ...company, landlinePhone: '(48) 98877-6655' },
      'landlinePhone',
    ],
    ['a bad e-mail', { ...company, email: 'contato@' }, 'email'],
    ['no name', { type: 'COMPANY' }, 'name'],
  ])('answers 400 for %s', async (_case, body, path) => {
    const response = await request('POST', '/brokers', body)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path }] })
    expect(await db.broker.count()).toBe(0)
  })
})

describe('POST /brokers with a document that does not fit', () => {
  it.each([
    ['a CPF for a company', { ...company, document: '529.982.247-25' }, 'Invalid CNPJ', 'COMPANY'],
    [
      'a CNPJ for an individual',
      { ...individual, document: '11.222.333/0001-81' },
      'Invalid CPF',
      'INDIVIDUAL',
    ],
    [
      'wrong check digits',
      { ...company, document: '12.ABC.345/01DE-36' },
      'Invalid CNPJ',
      'COMPANY',
    ],
  ])(
    'answers 400 INVALID_DOCUMENT for %s, the same as on update',
    async (_case, body, message, type) => {
      const response = await request('POST', '/brokers', body)

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        statusCode: 400,
        code: 'INVALID_DOCUMENT',
        message,
        details: { field: 'document', type },
      })
      expect(await db.broker.count()).toBe(0)
    },
  )
})

describe('GET /brokers', () => {
  it('lists only my brokers, sorted by name, and searches literally in any case', async () => {
    await createBroker(db, { userId: owner.id, name: 'Zélia Corretora' })
    await createBroker(db, { userId: owner.id, name: 'ana imóveis' })
    await createBroker(db, { userId: owner.id, name: 'Imobiliária 100%' })
    await createBroker(db, { userId: other.id, name: 'Ana do outro' })

    const all = (await request('GET', '/brokers')).json<{
      items: { name: string }[]
      total: number
    }>()
    const search = (await request('GET', '/brokers?search=IMÓ')).json<{
      items: { name: string }[]
    }>()
    const percent = (await request('GET', '/brokers?search=%25')).json<{
      items: { name: string }[]
    }>()

    expect(all.items.map((b) => b.name)).toEqual([
      'ana imóveis',
      'Imobiliária 100%',
      'Zélia Corretora',
    ])
    expect(all.total).toBe(3)
    expect(search.items.map((b) => b.name)).toEqual(['ana imóveis'])
    expect(percent.items.map((b) => b.name)).toEqual(['Imobiliária 100%'])
  })

  it('paginates', async () => {
    for (let i = 1; i <= 3; i++) {
      await createBroker(db, { userId: owner.id, name: `Corretor ${i}` })
    }

    const page = (await request('GET', '/brokers?page=2&pageSize=2')).json<{
      items: { name: string }[]
      total: number
    }>()

    expect(page.items.map((b) => b.name)).toEqual(['Corretor 3'])
    expect(page.total).toBe(3)
  })
})

describe('GET /brokers/:id', () => {
  it('answers my broker', async () => {
    const broker = await createBroker(db, { userId: owner.id, name: 'Litoral' })

    expect((await request('GET', `/brokers/${broker.id}`)).json()).toMatchObject({
      name: 'Litoral',
    })
  })

  it("answers 404 BROKER_NOT_FOUND for another user's broker", async () => {
    const broker = await createBroker(db, { userId: other.id })

    const response = await request('GET', `/brokers/${broker.id}`)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'BROKER_NOT_FOUND' })
  })

  it('answers 400 for an id that is not a UUID', async () => {
    expect((await request('GET', '/brokers/abc')).statusCode).toBe(400)
  })
})

describe('PATCH /brokers/:id', () => {
  it('changes only what is sent and clears fields sent as null or blank', async () => {
    const created = (await request('POST', '/brokers', company)).json<{ id: string }>()

    const response = await request('PATCH', `/brokers/${created.id}`, {
      name: 'Litoral Imóveis Ltda',
      email: null,
      landlinePhone: '',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      name: 'Litoral Imóveis Ltda',
      email: null,
      landlinePhone: null,
      document: '12ABC34501DE35',
      mobilePhone: '48988776655',
    })
  })

  it('turns a company into an individual when the CPF comes along', async () => {
    const created = (await request('POST', '/brokers', company)).json<{ id: string }>()

    const response = await request('PATCH', `/brokers/${created.id}`, {
      type: 'INDIVIDUAL',
      document: '529.982.247-25',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ type: 'INDIVIDUAL', document: '52998224725' })
  })

  it('answers 400 INVALID_DOCUMENT when the type changes but the document would not fit', async () => {
    const created = (await request('POST', '/brokers', company)).json<{ id: string }>()

    const response = await request('PATCH', `/brokers/${created.id}`, { type: 'INDIVIDUAL' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      statusCode: 400,
      code: 'INVALID_DOCUMENT',
      message: 'Invalid CPF',
      details: { field: 'document', type: 'INDIVIDUAL' },
    })
    expect((await db.broker.findUniqueOrThrow({ where: { id: created.id } })).type).toBe('COMPANY')
  })

  it('answers 400 INVALID_DOCUMENT for a document that does not fit the stored type', async () => {
    const created = (await request('POST', '/brokers', individual)).json<{ id: string }>()

    const response = await request('PATCH', `/brokers/${created.id}`, {
      document: '11.222.333/0001-81',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_DOCUMENT', message: 'Invalid CPF' })
  })

  it("answers 404 for another user's broker and leaves it untouched", async () => {
    const broker = await createBroker(db, { userId: other.id, name: 'Do outro' })

    expect((await request('PATCH', `/brokers/${broker.id}`, { name: 'X' })).statusCode).toBe(404)
    expect((await db.broker.findUniqueOrThrow({ where: { id: broker.id } })).name).toBe('Do outro')
  })

  it('answers 400 for an empty body', async () => {
    const broker = await createBroker(db, { userId: owner.id })

    expect((await request('PATCH', `/brokers/${broker.id}`, {})).statusCode).toBe(400)
  })
})

describe('DELETE /brokers/:id', () => {
  it('deletes my broker', async () => {
    const broker = await createBroker(db, { userId: owner.id })

    expect((await request('DELETE', `/brokers/${broker.id}`)).statusCode).toBe(204)
    expect(await db.broker.count()).toBe(0)
  })

  it('answers 409 BROKER_HAS_BOOKINGS while bookings reference it, and keeps it', async () => {
    const broker = await createBroker(db, { userId: owner.id })
    const property = await createProperty(db, { userId: owner.id })
    await createBooking(db, { userId: owner.id, propertyId: property.id, brokerId: broker.id })

    const response = await request('DELETE', `/brokers/${broker.id}`)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'BROKER_HAS_BOOKINGS' })
    expect(await db.broker.count()).toBe(1)
  })

  it("answers 404 for another user's broker and keeps it", async () => {
    const broker = await createBroker(db, { userId: other.id })

    expect((await request('DELETE', `/brokers/${broker.id}`)).statusCode).toBe(404)
    expect(await db.broker.count()).toBe(1)
  })
})

it('documents the routes', async () => {
  const paths = (await app.inject({ method: 'GET', url: '/docs/json' })).json<{
    paths: Record<string, object>
  }>().paths

  expect(Object.keys(paths['/brokers/'] ?? paths['/brokers'] ?? {})).toEqual(['get', 'post'])
  expect(Object.keys(paths['/brokers/{id}'] ?? {})).toEqual(['get', 'patch', 'delete'])
})
