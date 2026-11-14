import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { UsersRepository } from './users.repository.js'
import { currentPlan } from '../plans/current-plan.js'
import {
  myPlanSchema,
  publicUserSchema,
  toPublicUser,
  updateProfileBodySchema,
} from './users.schemas.js'
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

  app.get(
    '/me/plan',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'My plan',
        description: 'The plan in force, where it comes from, and how many properties it allows.',
        security: [{ bearerAuth: [] }],
        response: { 200: myPlanSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.user.sub
      await service.me(userId)
      const [{ plan, source, grant }, propertyCount] = await Promise.all([
        currentPlan(app.db, userId),
        app.db.property.count({ where: { userId } }),
      ])
      return {
        plan: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          maxProperties: plan.maxProperties,
        },
        source,
        endsAt: grant?.endsAt?.toISOString() ?? null,
        propertyCount,
        canAddProperty: plan.maxProperties === null || propertyCount < plan.maxProperties,
      }
    },
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
