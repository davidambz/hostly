import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createBooking, createProperty, createUser } from '../../test/factories.js'
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

const house = { name: 'Casa da praia', type: 'HOUSE', zipCode: '88053-700', state: 'sc' }
const apartment = {
  name: 'Apê Centro',
  type: 'APARTMENT',
  city: 'Balneário Camboriú',
  building: 'Mar Azul',
  block: 'B',
  unit: '1204',
}

describe('authentication', () => {
  it.each([
    ['GET', '/properties'],
    ['POST', '/properties'],
    ['GET', '/properties/018f0000-0000-7000-8000-000000000001'],
    ['PATCH', '/properties/018f0000-0000-7000-8000-000000000001'],
    ['DELETE', '/properties/018f0000-0000-7000-8000-000000000001'],
  ] as const)('%s %s answers 401 without a token', async (method, url) => {
    const response = await app.inject({
      method,
      url,
      payload: method === 'POST' ? house : undefined,
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('POST /properties', () => {
  it('creates a house, normalizing the address', async () => {
    const response = await request('POST', '/properties', house)

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      name: 'Casa da praia',
      type: 'HOUSE',
      zipCode: '88053700',
      state: 'SC',
      city: null,
      neighborhood: null,
      street: null,
      number: null,
      complement: null,
      building: null,
      block: null,
      unit: null,
      createdAt: expect.any(String) as string,
      updatedAt: expect.any(String) as string,
    })
    const stored = await db.property.findFirstOrThrow()
    expect(stored.userId).toBe(owner.id)
  })

  it('creates an apartment with its apartment fields', async () => {
    const response = await request('POST', '/properties', apartment)

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ building: 'Mar Azul', block: 'B', unit: '1204' })
  })

  it('ignores an owner sent in the body', async () => {
    await request('POST', '/properties', { ...house, userId: other.id })

    expect((await db.property.findFirstOrThrow()).userId).toBe(owner.id)
  })

  it.each([
    ['a house with apartment fields', { ...house, unit: '101' }, 'unit'],
    ['a bad CEP', { ...house, zipCode: '123' }, 'zipCode'],
    ['a bad UF', { ...house, state: 'XX' }, 'state'],
    ['no name', { type: 'HOUSE' }, 'name'],
    ['an unknown type', { name: 'X', type: 'CASTLE' }, 'type'],
  ])('answers 400 for %s', async (_case, body, path) => {
    const response = await request('POST', '/properties', body)

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path }] })
    expect(await db.property.count()).toBe(0)
  })
})

describe('GET /properties', () => {
  it('lists only my properties, sorted by name', async () => {
    await createProperty(db, { userId: owner.id, name: 'Sítio' })
    await createProperty(db, { userId: owner.id, name: 'apê centro' })
    await createProperty(db, { userId: owner.id, name: 'Casa' })
    await createProperty(db, { userId: other.id, name: 'Não é minha' })

    const response = await request('GET', '/properties')

    expect(response.statusCode).toBe(200)
    const body = response.json<{ items: { name: string }[]; total: number }>()
    expect(body.items.map((p) => p.name)).toEqual(['apê centro', 'Casa', 'Sítio'])
    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 3 })
  })

  it('answers an empty page when I have none', async () => {
    await createProperty(db, { userId: other.id })

    expect((await request('GET', '/properties')).json()).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    })
  })

  it('searches part of the name in any case', async () => {
    await createProperty(db, { userId: owner.id, name: 'Casa da Praia' })
    await createProperty(db, { userId: owner.id, name: 'Apê da praia' })
    await createProperty(db, { userId: owner.id, name: 'Sítio' })
    await createProperty(db, { userId: other.id, name: 'Praia do outro' })

    const body = (await request('GET', '/properties?search=PRAIA')).json<{
      items: { name: string }[]
      total: number
    }>()

    expect(body.items.map((p) => p.name)).toEqual(['Apê da praia', 'Casa da Praia'])
    expect(body.total).toBe(2)
  })

  it('treats search text literally, not as a pattern', async () => {
    await createProperty(db, { userId: owner.id, name: 'Casa' })

    expect((await request('GET', '/properties?search=%25')).json()).toMatchObject({ total: 0 })
    expect((await request('GET', '/properties?search=_')).json()).toMatchObject({ total: 0 })
  })

  it('paginates', async () => {
    for (let i = 1; i <= 5; i++) {
      await createProperty(db, { userId: owner.id, name: `Imóvel ${i}` })
    }

    const second = (await request('GET', '/properties?page=2&pageSize=2')).json<{
      items: { name: string }[]
    }>()
    const last = (await request('GET', '/properties?page=3&pageSize=2')).json<{
      items: { name: string }[]
    }>()
    const beyond = (await request('GET', '/properties?page=4&pageSize=2')).json<{
      items: unknown[]
      total: number
    }>()

    expect(second.items.map((p) => p.name)).toEqual(['Imóvel 3', 'Imóvel 4'])
    expect(last.items.map((p) => p.name)).toEqual(['Imóvel 5'])
    expect(beyond).toMatchObject({ items: [], total: 5 })
  })

  it.each(['page=0', 'pageSize=101', 'page=abc'])('answers 400 for %s', async (query) => {
    expect((await request('GET', `/properties?${query}`)).statusCode).toBe(400)
  })
})

describe('GET /properties/:id', () => {
  it('answers my property', async () => {
    const property = await createProperty(db, { userId: owner.id, name: 'Casa' })

    const response = await request('GET', `/properties/${property.id}`)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: property.id, name: 'Casa' })
  })

  it("answers 404 for another user's property, as if it didn't exist", async () => {
    const property = await createProperty(db, { userId: other.id })

    const response = await request('GET', `/properties/${property.id}`)

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      statusCode: 404,
      code: 'PROPERTY_NOT_FOUND',
      message: 'Property not found',
    })
  })

  it('answers 404 for an id that does not exist', async () => {
    const response = await request('GET', '/properties/018f0000-0000-7000-8000-000000000001')

    expect(response.statusCode).toBe(404)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    const response = await request('GET', '/properties/123')

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ details: [{ location: 'params', path: 'id' }] })
  })
})

describe('PATCH /properties/:id', () => {
  it('changes only what is sent and clears fields sent as null or blank', async () => {
    const property = await createProperty(db, {
      userId: owner.id,
      name: 'Casa',
      city: 'Florianópolis',
      complement: 'Fundos',
    })

    const response = await request('PATCH', `/properties/${property.id}`, {
      name: 'Casa nova',
      complement: null,
      neighborhood: '',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      name: 'Casa nova',
      city: 'Florianópolis',
      complement: null,
      neighborhood: null,
    })
  })

  it('bumps updatedAt', async () => {
    const property = await createProperty(db, { userId: owner.id })

    const response = await request('PATCH', `/properties/${property.id}`, { name: 'X' })

    expect(new Date(response.json<{ updatedAt: string }>().updatedAt).getTime()).toBeGreaterThan(
      property.updatedAt.getTime(),
    )
  })

  it('clears the apartment fields when an apartment becomes a house', async () => {
    const created = (await request('POST', '/properties', apartment)).json<{ id: string }>()

    const response = await request('PATCH', `/properties/${created.id}`, { type: 'HOUSE' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      type: 'HOUSE',
      building: null,
      block: null,
      unit: null,
    })
  })

  it('answers 400 APARTMENT_FIELDS_ON_HOUSE for apartment fields on a house', async () => {
    const property = await createProperty(db, { userId: owner.id, type: 'HOUSE' })

    const response = await request('PATCH', `/properties/${property.id}`, { unit: '101' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      code: 'APARTMENT_FIELDS_ON_HOUSE',
      details: { fields: ['unit'] },
    })
  })

  it('turns a house into an apartment with its fields', async () => {
    const property = await createProperty(db, { userId: owner.id, type: 'HOUSE' })

    const response = await request('PATCH', `/properties/${property.id}`, {
      type: 'APARTMENT',
      unit: '101',
    })

    expect(response.json()).toMatchObject({ type: 'APARTMENT', unit: '101' })
  })

  it("answers 404 for another user's property and leaves it untouched", async () => {
    const property = await createProperty(db, { userId: other.id, name: 'Do outro' })

    const response = await request('PATCH', `/properties/${property.id}`, { name: 'Hackeado' })

    expect(response.statusCode).toBe(404)
    expect((await db.property.findUniqueOrThrow({ where: { id: property.id } })).name).toBe(
      'Do outro',
    )
  })

  it.each([
    ['an empty body', {}],
    ['a blank name', { name: ' ' }],
    ['a bad CEP', { zipCode: 'abc' }],
  ])('answers 400 for %s', async (_case, body) => {
    const property = await createProperty(db, { userId: owner.id })

    expect((await request('PATCH', `/properties/${property.id}`, body)).statusCode).toBe(400)
  })
})

describe('DELETE /properties/:id', () => {
  it('deletes my property', async () => {
    const property = await createProperty(db, { userId: owner.id })

    const response = await request('DELETE', `/properties/${property.id}`)

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expect(await db.property.count()).toBe(0)
  })

  it('answers 409 PROPERTY_HAS_BOOKINGS while it has bookings, and keeps it', async () => {
    const property = await createProperty(db, { userId: owner.id })
    await createBooking(db, { userId: owner.id, propertyId: property.id })

    const response = await request('DELETE', `/properties/${property.id}`)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'PROPERTY_HAS_BOOKINGS' })
    expect(await db.property.count()).toBe(1)
  })

  it("answers 404 for another user's property and keeps it", async () => {
    const property = await createProperty(db, { userId: other.id })

    expect((await request('DELETE', `/properties/${property.id}`)).statusCode).toBe(404)
    expect(await db.property.count()).toBe(1)
  })

  it('answers 404 the second time', async () => {
    const property = await createProperty(db, { userId: owner.id })
    await request('DELETE', `/properties/${property.id}`)

    expect((await request('DELETE', `/properties/${property.id}`)).statusCode).toBe(404)
  })
})

it('documents the routes', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/json' })

  const paths = response.json<{ paths: Record<string, object> }>().paths
  expect(Object.keys(paths['/properties/'] ?? paths['/properties'] ?? {})).toEqual(['get', 'post'])
  expect(Object.keys(paths['/properties/{id}'] ?? {})).toEqual(['get', 'patch', 'delete'])
})

it('treats a backslash in the search literally too', async () => {
  await createProperty(db, { userId: owner.id, name: 'Casa' })
  await createProperty(db, { userId: owner.id, name: 'Sala \\ 2' })

  const body = (await request('GET', `/properties?search=${encodeURIComponent('\\')}`)).json<{
    items: { name: string }[]
  }>()

  expect(body.items.map((p) => p.name)).toEqual(['Sala \\ 2'])
})

it('sorts accents and case the way people read them', async () => {
  for (const name of ['Sítio', 'Ápice', 'casa', 'Casa B', 'abc']) {
    await createProperty(db, { userId: owner.id, name })
  }

  const body = (await request('GET', '/properties')).json<{ items: { name: string }[] }>()

  expect(body.items.map((p) => p.name)).toEqual(['abc', 'Ápice', 'casa', 'Casa B', 'Sítio'])
})
