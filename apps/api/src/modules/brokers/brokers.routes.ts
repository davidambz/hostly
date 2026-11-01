import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { mapPage } from '../../shared/pagination.js'
import { BrokersRepository } from './brokers.repository.js'
import {
  createBrokerBodySchema,
  listBrokersQuerySchema,
  brokerIdParamsSchema,
  brokerPageSchema,
  brokerSchema,
  toPublicBroker,
  updateBrokerBodySchema,
} from './brokers.schemas.js'
import { BrokersService } from './brokers.service.js'

const tags = ['brokers']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema }

export const brokersRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new BrokersService(new BrokersRepository(app.db))

  app.addHook('onRequest', app.authenticate)

  app.get(
    // '', not '/': the route is the prefix itself (/x), without a trailing slash.
    '',
    {
      schema: {
        tags,
        security,
        summary: 'List my brokers',
        description: 'Sorted by name; `search` matches part of the name, in any case.',
        querystring: listBrokersQuerySchema,
        response: { 200: brokerPageSchema, ...errors },
      },
    },
    async (request) => mapPage(await service.list(request.user.sub, request.query), toPublicBroker),
  )

  app.get(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Get one of my brokers',
        params: brokerIdParamsSchema,
        response: { 200: brokerSchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request) => toPublicBroker(await service.get(request.user.sub, request.params.id)),
  )

  app.post(
    // '', not '/': the route is the prefix itself (/x), without a trailing slash.
    '',
    {
      schema: {
        tags,
        security,
        summary: 'Add a broker',
        description:
          'An individual (CPF) or a company (CNPJ, numeric or alphanumeric). Document, ' +
          'e-mail and phones are optional; masks are accepted and stripped.',
        body: createBrokerBodySchema,
        response: { 201: brokerSchema, ...errors },
      },
    },
    async (request, reply) => {
      const broker = await service.create(request.user.sub, request.body)
      return reply.status(201).send(toPublicBroker(broker))
    },
  )

  app.patch(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Change a broker',
        description:
          'Send only what changes; `null` clears an optional field. The document must fit ' +
          'the resulting type (400 INVALID_DOCUMENT otherwise), so send it when changing type.',
        params: brokerIdParamsSchema,
        body: updateBrokerBodySchema,
        response: { 200: brokerSchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request) =>
      toPublicBroker(await service.update(request.user.sub, request.params.id, request.body)),
  )

  app.delete(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Delete a broker',
        description: 'Answers 409 BROKER_HAS_BOOKINGS while bookings still reference it.',
        params: brokerIdParamsSchema,
        response: {
          204: z.null(),
          ...errors,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await service.delete(request.user.sub, request.params.id)
      return reply.status(204).send(null)
    },
  )
}
