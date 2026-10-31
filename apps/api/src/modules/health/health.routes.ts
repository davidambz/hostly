import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { HealthService } from './health.service.js'

const componentStatusSchema = z.enum(['up', 'down'])

const healthReportSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  checks: z.object({ database: componentStatusSchema }),
})

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new HealthService(app.db)

  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        description: 'Answers 200 when the API and its database are up, 503 otherwise.',
        response: { 200: healthReportSchema, 503: healthReportSchema },
      },
      config: { rateLimit: false },
    },
    async (request, reply) => {
      const report = await service.check()
      if (report.status !== 'ok') {
        request.log.warn({ checks: report.checks }, 'health check failed')
        return reply.status(503).send(report)
      }
      return report
    },
  )
}
