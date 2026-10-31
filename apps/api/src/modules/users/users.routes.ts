import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { UnauthorizedError } from '../../shared/errors.js'
import { UsersRepository } from './users.repository.js'
import { publicUserSchema, toPublicUser } from './users.schemas.js'

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  const users = new UsersRepository(app.db)

  app.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'The logged-in user',
        security: [{ bearerAuth: [] }],
        response: { 200: publicUserSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const user = await users.findById(request.user.sub)
      // The token outlived the account.
      if (!user) {
        throw new UnauthorizedError('Account no longer exists', { code: 'INVALID_TOKEN' })
      }
      return toPublicUser(user)
    },
  )
}
