import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { planSchema, toPublicPlan } from './plans.schemas.js'
import { PlansService } from './plans.service.js'

/** The plans on sale, for any logged-in user choosing one. */
export const plansRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new PlansService(app.db)

  app.get(
    '/plans',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['plans'],
        summary: 'The plans on sale',
        description:
          'Free first, then by name. Prices in cents; null while a period is not offered.',
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(planSchema), 401: errorResponseSchema },
      },
    },
    async () => (await service.list()).filter((plan) => plan.active).map(toPublicPlan),
  )
}
