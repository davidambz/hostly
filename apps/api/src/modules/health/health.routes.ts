import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

const healthResponseSchema = z.object({
  status: z.literal('ok'),
})

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness check',
        response: { 200: healthResponseSchema },
      },
      config: { rateLimit: false },
    },
    () => ({ status: 'ok' as const }),
  )
}
