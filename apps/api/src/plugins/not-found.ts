import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import type { ErrorResponse } from '../shared/error-response.js'

// Unknown routes count against the rate limit too, so the API can't be scanned for free.
const notFound: FastifyPluginAsync = async (app) => {
  app.setNotFoundHandler({ preHandler: app.rateLimit() }, (request, reply) => {
    const body: ErrorResponse = {
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    }
    return reply.status(404).send(body)
  })
}

export default fp(notFound, { name: 'not-found', dependencies: ['security'] })
