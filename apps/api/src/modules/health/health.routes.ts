import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { HealthRepository } from './health.repository.js'
import { livenessSchema, readinessSchema } from './health.schemas.js'
import { HealthService } from './health.service.js'

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new HealthService(new HealthRepository(app.db))

  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness',
        description:
          'Answers 200 while the process is up, whatever the state of its dependencies. ' +
          'Use it to decide whether to restart the container.',
        response: { 200: livenessSchema },
      },
      config: { rateLimit: false },
    },
    () => ({ status: 'ok' as const }),
  )

  // The 503 here is the readiness report itself, not an API error, so it keeps this
  // shape instead of going through the error handler.
  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness',
        description:
          'Answers 200 when the API can serve requests (database reachable) and 503 ' +
          'otherwise. Use it to decide whether to send traffic to the instance.',
        response: { 200: readinessSchema, 503: readinessSchema },
      },
      config: { rateLimit: false },
    },
    async (request, reply) => {
      const report = await service.readiness()
      if (report.status !== 'ready') {
        request.log.warn({ checks: report.checks }, 'readiness check failed')
      }
      return reply.status(report.status === 'ready' ? 200 : 503).send(report)
    },
  )
}
