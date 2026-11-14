import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { UsersRepository } from './users.repository.js'
import { publicUserSchema, toPublicUser, updateProfileBodySchema } from './users.schemas.js'
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

  app.patch(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Change the name or the e-mail',
        description:
          'Send only what changes; the e-mail is stored lowercase. 409 EMAIL_TAKEN when ' +
          'another account uses the e-mail.',
        security: [{ bearerAuth: [] }],
        body: updateProfileBodySchema,
        response: {
          200: publicUserSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request) => toPublicUser(await service.updateProfile(request.user.sub, request.body)),
  )
}
