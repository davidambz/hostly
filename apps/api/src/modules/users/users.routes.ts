import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { UsersRepository } from './users.repository.js'
import { publicUserSchema, toPublicUser } from './users.schemas.js'
import { UsersService } from './users.service.js'

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new UsersService(new UsersRepository(app.db))

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
    async (request) => toPublicUser(await service.me(request.user.sub)),
  )
}
