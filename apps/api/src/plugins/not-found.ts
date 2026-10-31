import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import type { ErrorResponse } from '../shared/error-response.js'

// Unknown routes count against the rate limit too, so the API can't be scanned for free.
// The limit runs in `onRequest`, before the body is read, which the not-found handler's
// own hooks (preValidation/preHandler) would only reach after parsing it.
const notFound: FastifyPluginAsync = async (app) => {
  const limit = app.rateLimit()

  app.addHook('onRequest', async function (request, reply) {
    if (request.is404) {
      await limit.call(this, request, reply)
    }
  })

  app.setNotFoundHandler((request, reply) => {
    const body: ErrorResponse = {
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    }
    return reply.status(404).send(body)
  })
}

export default fp(notFound, { name: 'not-found', dependencies: ['security'] })
