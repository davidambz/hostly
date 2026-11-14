import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { AdminRepository } from './admin.repository.js'
import {
  adminUserPageSchema,
  listUsersQuerySchema,
  setAdminBodySchema,
  userIdParamsSchema,
} from './admin.schemas.js'
import { AdminService } from './admin.service.js'

const tags = ['admin']
const security = [{ bearerAuth: [] }]
const errors = { 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema }

/**
 * The backoffice. Every route needs a logged-in administrator: 401 without a token, 403
 * ADMIN_ONLY for anyone else, checked against the database on every request.
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new AdminService(new AdminRepository(app.db), app.db)

  app.addHook('onRequest', app.authenticate)
  app.addHook('onRequest', async (request) => {
    await service.assertAdmin(request.user.sub)
  })

  app.get(
    '/users',
    {
      schema: {
        tags,
        security,
        summary: 'List the accounts',
        description: 'Sorted by name; `search` matches part of the name or the e-mail.',
        querystring: listUsersQuerySchema,
        response: { 200: adminUserPageSchema, ...errors },
      },
    },
    async (request) => service.listUsers(request.query),
  )

  app.patch(
    '/users/:id/admin',
    {
      schema: {
        tags,
        security,
        summary: 'Grant or remove the administrator role',
        description: '409 OWN_ADMIN_ROLE for your own account; 404 USER_NOT_FOUND.',
        params: userIdParamsSchema,
        body: setAdminBodySchema,
        response: {
          204: z.null(),
          ...errors,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await service.setAdmin(request.user.sub, request.params.id, request.body.isAdmin)
      return reply.status(204).send(null)
    },
  )
}
