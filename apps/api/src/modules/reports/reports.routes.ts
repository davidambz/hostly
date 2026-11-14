import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { ReportsRepository } from './reports.repository.js'
import { performanceSchema, periodQuerySchema } from './reports.schemas.js'
import { ReportsService } from './reports.service.js'

const tags = ['reports']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema }

/** Reports on the user's properties, for any plan. */
export const reportsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new ReportsService(new ReportsRepository(app.db))

  app.addHook('onRequest', app.authenticate)

  app.get(
    '/performance',
    {
      schema: {
        tags,
        security,
        summary: 'How each property did in a period',
        description:
          'From `from` to the day before `to` (at most 731 days). Every property, zeros ' +
          'included, and the total. A booking crossing the edges counts only its nights ' +
          'inside, with its lodging and broker fee spread per night; the cleaning fee counts ' +
          'on the check-in day. Money in cents.',
        querystring: periodQuerySchema,
        response: { 200: performanceSchema, ...errors },
      },
    },
    async (request) => ({
      ...request.query,
      ...(await service.performance(request.user.sub, request.query.from, request.query.to)),
    }),
  )
}
