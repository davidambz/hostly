import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import type { Env } from '../config/env.js'

export interface SecurityOptions {
  corsOrigins: Env['CORS_ORIGINS']
  rateLimitMax: Env['RATE_LIMIT_MAX']
}

const security: FastifyPluginAsync<SecurityOptions> = async (app, options) => {
  await app.register(helmet)

  await app.register(cors, {
    origin: options.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-request-id'],
  })

  await app.register(rateLimit, {
    max: options.rateLimitMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded, retry in ${context.after}`,
    }),
  })
}

export default fp(security, { name: 'security' })
