import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import {
  createPlanBodySchema,
  planIdParamsSchema,
  planSchema,
  toPublicPlan,
  updatePlanBodySchema,
} from './plans.schemas.js'
import { PlansService } from './plans.service.js'

const tags = ['admin']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema }

/** The plans in the backoffice. Registered inside the admin routes, behind their checks. */
export const plansAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new PlansService(app.db)

  app.get(
    '/plans',
    {
      schema: {
        tags,
        security,
        summary: 'List the plans',
        description: 'Free first, then by name; on sale or not.',
        response: { 200: z.array(planSchema), ...errors },
      },
    },
    async () => (await service.list()).map(toPublicPlan),
  )

  app.post(
    '/plans',
    {
      schema: {
        tags,
        security,
        summary: 'Create a plan',
        description: 'Prices in cents, per period; null while a period is not offered.',
        body: createPlanBodySchema,
        response: { 201: planSchema, ...errors },
      },
    },
    async (request, reply) =>
      reply.status(201).send(toPublicPlan(await service.create(request.body))),
  )

  app.patch(
    '/plans/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Change a plan',
        description:
          'Send only what changes; `active: false` takes it off sale. 400 FREE_PLAN_IS_FREE ' +
          'for a price on Free or turning it off; 404 PLAN_NOT_FOUND.',
        params: planIdParamsSchema,
        body: updatePlanBodySchema,
        response: { 200: planSchema, ...errors, 404: errorResponseSchema },
      },
    },
    async (request) => toPublicPlan(await service.update(request.params.id, request.body)),
  )
}
