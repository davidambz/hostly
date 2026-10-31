import { Writable } from 'node:stream'

import Fastify, { type FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../shared/errors.js'
import errorHandler from './error-handler.js'

let app: FastifyInstance
let logs: Record<string, unknown>[]

async function buildTestApp() {
  logs = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logs.push(JSON.parse(chunk.toString()) as Record<string, unknown>)
      callback()
    },
  })

  const instance = Fastify({
    logger: { level: 'error', stream },
  }).withTypeProvider<ZodTypeProvider>()
  instance.setValidatorCompiler(validatorCompiler)
  instance.setSerializerCompiler(serializerCompiler)
  await instance.register(errorHandler)

  instance.get('/errors/bad-request', () => {
    throw new BadRequestError('Bad input')
  })
  instance.get('/errors/unauthorized', () => {
    throw new UnauthorizedError('Not logged in')
  })
  instance.get('/errors/forbidden', () => {
    throw new ForbiddenError('Not yours')
  })
  instance.get('/errors/not-found', () => {
    throw new NotFoundError('Property not found')
  })
  instance.get('/errors/conflict', () => {
    throw new ConflictError('Dates overlap', { bookingId: 'b1' })
  })
  instance.get('/errors/unexpected', () => {
    throw new Error('database password is hunter2')
  })
  instance.get('/errors/service-unavailable', () => {
    throw Object.assign(new Error('upstream is down'), { statusCode: 503 })
  })
  instance.get('/errors/thrown-string', () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 'boom'
  })
  instance.get('/errors/thrown-undefined', () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw undefined
  })
  instance.get('/errors/thrown-null', () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw null
  })
  instance.get('/errors/client-without-code', () => {
    throw Object.assign(new Error('Gone for good'), { statusCode: 410 })
  })
  instance.get('/errors/client-without-message', () => {
    throw Object.assign(new Error(''), { statusCode: 418 })
  })
  instance.get('/errors/client-with-unknown-status', () => {
    throw Object.assign(new Error(''), { statusCode: 499 })
  })
  instance.get('/errors/client-with-non-string-code', () => {
    throw Object.assign(new Error('Nope'), { statusCode: 404, code: 42 })
  })
  instance.get('/errors/status-not-a-number', () => {
    throw Object.assign(new Error('weird'), { statusCode: '404' })
  })

  instance.post(
    '/validate/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        querystring: z.object({ page: z.coerce.number().int().positive().optional() }),
        body: z.object({
          name: z.string().min(1),
          address: z.object({ zip: z.string().regex(/^\d{8}$/) }),
        }),
      },
    },
    () => ({ ok: true }),
  )

  instance.get(
    '/serialization',
    { schema: { response: { 200: z.object({ id: z.string() }) } } },
    () => ({ id: 123 }) as unknown as { id: string },
  )

  return instance
}

beforeEach(async () => {
  app = await buildTestApp()
})

afterEach(async () => {
  await app.close()
})

const VALID_ID = '7f1c2a9e-4a8b-4e8f-9b1a-2c3d4e5f6a7b'
const validBody = { name: 'Casa da praia', address: { zip: '88000000' } }

describe('error handler', () => {
  describe('domain errors', () => {
    it.each([
      ['/errors/bad-request', 400, 'BAD_REQUEST', 'Bad input'],
      ['/errors/unauthorized', 401, 'UNAUTHORIZED', 'Not logged in'],
      ['/errors/forbidden', 403, 'FORBIDDEN', 'Not yours'],
      ['/errors/not-found', 404, 'NOT_FOUND', 'Property not found'],
    ])('%s answers %i %s', async (url, statusCode, code, message) => {
      const response = await app.inject({ method: 'GET', url })

      expect(response.statusCode).toBe(statusCode)
      expect(response.json()).toEqual({ statusCode, code, message })
    })

    it('includes details when the error has them', async () => {
      const response = await app.inject({ method: 'GET', url: '/errors/conflict' })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toEqual({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Dates overlap',
        details: { bookingId: 'b1' },
      })
    })

    it('does not log expected domain errors', async () => {
      await app.inject({ method: 'GET', url: '/errors/not-found' })

      expect(logs).toEqual([])
    })
  })

  describe('validation errors', () => {
    it('answers 400 with one issue per invalid body field, using dotted paths', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/validate/${VALID_ID}`,
        payload: { name: '', address: { zip: '123' } },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json<{ code: string; details: unknown[] }>()
      expect(body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'The request is invalid',
      })
      expect(body.details).toHaveLength(2)
      expect(body.details).toEqual(
        expect.arrayContaining([
          { location: 'body', path: 'name', message: expect.any(String) as string },
          { location: 'body', path: 'address.zip', message: expect.any(String) as string },
        ]),
      )
    })

    it('reports a missing body', async () => {
      const response = await app.inject({ method: 'POST', url: `/validate/${VALID_ID}` })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ location: 'body', path: '' }],
      })
    })

    it('reports invalid route params', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/validate/not-a-uuid',
        payload: validBody,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ location: 'params', path: 'id' }],
      })
    })

    it('reports an invalid querystring', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/validate/${VALID_ID}?page=-1`,
        payload: validBody,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ location: 'querystring', path: 'page' }],
      })
    })

    it('lets a valid request through', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/validate/${VALID_ID}?page=2`,
        payload: validBody,
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ ok: true })
    })
  })

  describe('client errors raised by Fastify', () => {
    it('keeps the 400 of a malformed JSON body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/validate/${VALID_ID}`,
        headers: { 'content-type': 'application/json' },
        payload: '{"name": ',
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        statusCode: 400,
        code: 'FST_ERR_CTP_INVALID_JSON_BODY',
        message: expect.any(String) as string,
      })
    })

    it('keeps the 415 of an unsupported content type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/validate/${VALID_ID}`,
        headers: { 'content-type': 'application/xml' },
        payload: '<name />',
      })

      expect(response.statusCode).toBe(415)
      expect(response.json()).toMatchObject({
        statusCode: 415,
        code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
      })
    })

    it('derives the code from the status when a client error has none', async () => {
      const response = await app.inject({ method: 'GET', url: '/errors/client-without-code' })

      expect(response.statusCode).toBe(410)
      expect(response.json()).toEqual({ statusCode: 410, code: 'GONE', message: 'Gone for good' })
    })

    it('ignores a code that is not a string', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/errors/client-with-non-string-code',
      })

      expect(response.json()).toEqual({ statusCode: 404, code: 'NOT_FOUND', message: 'Nope' })
    })

    it('falls back to the status text when a client error has no message', async () => {
      const response = await app.inject({ method: 'GET', url: '/errors/client-without-message' })

      expect(response.statusCode).toBe(418)
      expect(response.json()).toEqual({
        statusCode: 418,
        code: 'I_M_A_TEAPOT',
        message: "I'm a Teapot",
      })
    })

    it('handles a 4xx status that has no standard name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/errors/client-with-unknown-status',
      })

      expect(response.statusCode).toBe(499)
      expect(response.json()).toEqual({
        statusCode: 499,
        code: 'CLIENT_ERROR',
        message: 'Client error',
      })
    })
  })

  describe('unexpected errors', () => {
    it('answers a generic 500 without leaking the original message', async () => {
      const response = await app.inject({ method: 'GET', url: '/errors/unexpected' })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      })
      expect(response.body).not.toContain('hunter2')
    })

    it('logs the original error with the request id', async () => {
      const response = await app.inject({ method: 'GET', url: '/errors/unexpected' })

      expect(response.statusCode).toBe(500)
      expect(logs).toContainEqual(
        expect.objectContaining({
          msg: 'unhandled error',
          reqId: expect.any(String) as string,
          err: expect.objectContaining({ message: 'database password is hunter2' }) as object,
        }),
      )
    })

    it('hides 5xx errors that carry their own status code', async () => {
      const response = await app.inject({ method: 'GET', url: '/errors/service-unavailable' })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
      expect(response.body).not.toContain('upstream')
    })

    it.each(['thrown-string', 'thrown-undefined', 'thrown-null', 'status-not-a-number'])(
      'answers the standard 500 for %s',
      async (route) => {
        const response = await app.inject({ method: 'GET', url: `/errors/${route}` })

        expect(response.statusCode).toBe(500)
        expect(response.json()).toEqual({
          statusCode: 500,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong',
        })
        expect(logs).toContainEqual(expect.objectContaining({ msg: 'unhandled error' }))
      },
    )

    it('answers 500 when a response does not match its schema', async () => {
      const response = await app.inject({ method: 'GET', url: '/serialization' })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
      expect(logs).toHaveLength(1)
    })
  })
})
