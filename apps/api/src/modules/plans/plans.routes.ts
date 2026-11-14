import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { planSchema, toPublicPlan } from './plans.schemas.js'
import { PlansService } from './plans.service.js'

/** The plans on sale: public, so the home page can show the real prices. */
export const plansRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new PlansService(app.db)

  app.get(
    '/plans',
    {
      schema: {
        tags: ['plans'],
        summary: 'The plans on sale',
        description:
          'Public. Free first, then by name. Prices in cents; null while a period is not offered.',
        response: { 200: z.array(planSchema) },
      },
    },
    async () => (await service.list()).filter((plan) => plan.active).map(toPublicPlan),
  )
}
