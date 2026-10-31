import { randomUUID } from 'node:crypto'

import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import type { Env } from './config/env.js'
import { healthRoutes } from './modules/health/health.routes.js'
import errorHandler from './plugins/error-handler.js'
import notFound from './plugins/not-found.js'
import security from './plugins/security.js'
import swagger from './plugins/swagger.js'

const REQUEST_ID_HEADER = 'x-request-id'
const VALID_REQUEST_ID = /^[\w-]{1,128}$/

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'development') {
    return {
      level: env.LOG_LEVEL,
      transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid' } },
    }
  }
  return { level: env.LOG_LEVEL }
}

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: loggerOptions(env),
    trustProxy: env.TRUST_PROXY,
    // Reuse the caller's request id (e.g. from a proxy) only when it is safe to log.
    genReqId: (request) => {
      const incoming = request.headers[REQUEST_ID_HEADER]
      return typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
        ? incoming
        : randomUUID()
    },
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.addHook('onRequest', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id)
  })

  await app.register(errorHandler)
  await app.register(security, {
    corsOrigins: env.CORS_ORIGINS,
    rateLimitMax: env.RATE_LIMIT_MAX,
  })
  await app.register(notFound)
  if (env.DOCS_ENABLED) {
    await app.register(swagger)
  }

  await app.register(healthRoutes)

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
