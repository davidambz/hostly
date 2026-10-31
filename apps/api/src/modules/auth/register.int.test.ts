import { verify } from '@node-rs/argon2'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App

const validBody = {
  name: 'Ana Souza',
  email: 'ana@hostly.dev',
  cpf: '529.982.247-25',
  phone: '(48) 99999-0000',
  password: 'correct horse battery',
}

function register(payload: object, remoteAddress?: string) {
  return app.inject({ method: 'POST', url: '/auth/register', payload, remoteAddress })
}

beforeEach(async () => {
  app = await buildApp(testEnv(), { db })
})

afterEach(async () => {
  await app.close()
})

describe('POST /auth/register', () => {
  describe('success', () => {
    it('answers 201 with the public user', async () => {
      const response = await register(validBody)

      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
        name: 'Ana Souza',
        email: 'ana@hostly.dev',
        cpf: '52998224725',
        phone: '48999990000',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
      })
    })

    it('never returns the password or its hash', async () => {
      const response = await register(validBody)

      expect(response.body).not.toContain('correct horse')
      expect(response.body).not.toContain('argon2')
      expect(response.json()).not.toHaveProperty('passwordHash')
    })

    it('stores normalized values and an argon2id hash of the password', async () => {
      await register({
        ...validBody,
        name: '  Ana Souza  ',
        email: '  Ana@Hostly.DEV ',
      })

      const user = await db.user.findUniqueOrThrow({ where: { email: 'ana@hostly.dev' } })
      expect(user).toMatchObject({
        name: 'Ana Souza',
        cpf: '52998224725',
        phone: '48999990000',
      })
      expect(user.passwordHash).toMatch(/^\$argon2id\$/)
      await expect(verify(user.passwordHash, 'correct horse battery')).resolves.toBe(true)
    })

    it('accepts a landline phone and unmasked CPF', async () => {
      const response = await register({ ...validBody, cpf: '52998224725', phone: '4833334444' })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toMatchObject({ phone: '4833334444' })
    })

    it('ignores fields it does not know, such as a password hash or id', async () => {
      const response = await register({
        ...validBody,
        id: '018f0000-0000-7000-8000-000000000001',
        passwordHash: 'injected',
      })

      expect(response.statusCode).toBe(201)
      const user = await db.user.findUniqueOrThrow({ where: { email: 'ana@hostly.dev' } })
      expect(user.id).not.toBe('018f0000-0000-7000-8000-000000000001')
      expect(user.passwordHash).not.toBe('injected')
    })
  })

  describe('conflicts', () => {
    it('answers 409 EMAIL_TAKEN for an e-mail already in use, whatever its case', async () => {
      await createUser(db, { email: 'ana@hostly.dev' })

      const response = await register({ ...validBody, email: 'ANA@hostly.dev' })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toEqual({
        statusCode: 409,
        code: 'EMAIL_TAKEN',
        message: 'E-mail already registered',
        details: { field: 'email' },
      })
    })

    it('answers 409 CPF_TAKEN for a CPF already in use, masked or not', async () => {
      await createUser(db, { cpf: '52998224725' })

      const response = await register(validBody)

      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({ code: 'CPF_TAKEN', details: { field: 'cpf' } })
    })

    it('does not create a second user on conflict', async () => {
      await register(validBody)
      await register(validBody)

      expect(await db.user.count()).toBe(1)
    })

    it('lets exactly one of two simultaneous signups with the same e-mail through', async () => {
      const [first, second] = await Promise.all([
        register(validBody),
        register({ ...validBody, cpf: '111.444.777-35' }),
      ])

      expect([first.statusCode, second.statusCode].sort()).toEqual([201, 409])
      expect(await db.user.count()).toBe(1)
    })
  })

  describe('validation', () => {
    it.each([
      ['name', ''],
      ['name', '   '],
      ['email', 'not-an-email'],
      ['cpf', '529.982.247-26'],
      ['cpf', '111.111.111-11'],
      ['phone', '(20) 99999-0000'],
      ['phone', '9999-0000'],
      ['password', 'short'],
    ])('answers 400 for an invalid %s (%j)', async (field, value) => {
      const response = await register({ ...validBody, [field]: value })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ location: 'body', path: field }],
      })
    })

    it.each(['name', 'email', 'cpf', 'phone', 'password'])(
      'answers 400 when %s is missing',
      async (field) => {
        const { [field as keyof typeof validBody]: _omitted, ...body } = validBody

        const response = await register(body)

        expect(response.statusCode).toBe(400)
        expect(response.json()).toMatchObject({ details: [{ path: field }] })
      },
    )

    it('reports every invalid field at once', async () => {
      const response = await register({ name: '', email: 'x', cpf: '1', phone: '1', password: '1' })

      const paths = response.json<{ details: { path: string }[] }>().details.map((d) => d.path)
      expect(paths.sort()).toEqual(['cpf', 'email', 'name', 'password', 'phone'])
    })

    it('answers 400 for a body that is not an object', async () => {
      const response = await register(['ana@hostly.dev'])

      expect(response.statusCode).toBe(400)
    })

    it('creates nothing when the input is invalid', async () => {
      await register({ ...validBody, cpf: 'invalid' })

      expect(await db.user.count()).toBe(0)
    })
  })

  describe('rate limit', () => {
    it('answers 429 after AUTH_RATE_LIMIT_MAX attempts from the same client', async () => {
      await app.close()
      app = await buildApp(testEnv({ AUTH_RATE_LIMIT_MAX: '2' }), { db })

      const statuses = []
      for (let i = 0; i < 3; i++) {
        statuses.push((await register({ ...validBody, cpf: 'invalid' }, '10.0.0.1')).statusCode)
      }

      expect(statuses).toEqual([400, 400, 429])
      expect((await register(validBody, '10.0.0.2')).statusCode).toBe(201)
    })
  })

  it('is documented in the OpenAPI spec with its responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' })

    const operation = response.json<{
      paths: Record<string, { post: { responses: Record<string, unknown> } }>
    }>().paths['/auth/register']?.post
    expect(Object.keys(operation?.responses ?? {})).toEqual(['201', '400', '409', '429'])
  })
})
