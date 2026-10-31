import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { mapPage } from '../../shared/pagination.js'
import { PropertiesRepository } from './properties.repository.js'
import {
  createPropertyBodySchema,
  listPropertiesQuerySchema,
  propertyIdParamsSchema,
  propertyPageSchema,
  propertySchema,
  toPublicProperty,
  updatePropertyBodySchema,
} from './properties.schemas.js'
import { PropertiesService } from './properties.service.js'

const tags = ['properties']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema }

export const propertiesRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new PropertiesService(new PropertiesRepository(app.db))

  app.addHook('onRequest', app.authenticate)

  app.get(
    '/',
    {
      schema: {
        tags,
        security,
        summary: 'List my properties',
        description: 'Sorted by name; `search` matches part of the name, in any case.',
        querystring: listPropertiesQuerySchema,
        response: { 200: propertyPageSchema, ...errors },
      },
    },
    async (request) =>
      mapPage(await service.list(request.user.sub, request.query), toPublicProperty),
  )

  app.get(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Get one of my properties',
        params: propertyIdParamsSchema,
        response: { 200: propertySchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request) => toPublicProperty(await service.get(request.user.sub, request.params.id)),
  )

  app.post(
    '/',
    {
      schema: {
        tags,
        security,
        summary: 'Add a property',
        description:
          'Address fields are optional; CEP accepts a mask and the UF any case. `building`, ' +
          '`block` and `unit` are for apartments only.',
        body: createPropertyBodySchema,
        response: { 201: propertySchema, ...errors },
      },
    },
    async (request, reply) => {
      const property = await service.create(request.user.sub, request.body)
      return reply.status(201).send(toPublicProperty(property))
    },
  )

  app.patch(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Change a property',
        description:
          'Send only what changes; `null` clears an optional field. Turning an apartment ' +
          'into a house clears its apartment fields.',
        params: propertyIdParamsSchema,
        body: updatePropertyBodySchema,
        response: { 200: propertySchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request) =>
      toPublicProperty(await service.update(request.user.sub, request.params.id, request.body)),
  )

  app.delete(
    '/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Delete a property',
        description: 'Answers 409 PROPERTY_HAS_BOOKINGS while it still has bookings.',
        params: propertyIdParamsSchema,
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
