import { randomUUID } from 'node:crypto'

import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import type { Env } from './config/env.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { brokersRoutes } from './modules/brokers/brokers.routes.js'
import { healthRoutes } from './modules/health/health.routes.js'
import { propertiesRoutes } from './modules/properties/properties.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import auth from './plugins/auth.js'
import database from './plugins/database.js'
import errorHandler from './plugins/error-handler.js'
import notFound from './plugins/not-found.js'
import security from './plugins/security.js'
import swagger from './plugins/swagger.js'
import type { Database } from './shared/database.js'

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

export interface BuildAppOptions {
  /** Reuse an existing database client instead of opening one from DATABASE_URL. */
  db?: Database
}

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
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
  await app.register(database, { url: env.DATABASE_URL, client: options.db })
  await app.register(auth, {
    jwtSecret: env.JWT_SECRET,
    accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  })
  if (env.DOCS_ENABLED) {
    await app.register(swagger)
  }

  await app.register(healthRoutes)
  await app.register(authRoutes, {
    prefix: '/auth',
    rateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    cookieSecure: env.COOKIE_SECURE,
  })
  await app.register(usersRoutes)
  await app.register(propertiesRoutes, { prefix: '/properties' })
  await app.register(brokersRoutes, { prefix: '/brokers' })

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
