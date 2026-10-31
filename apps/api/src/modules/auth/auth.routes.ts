import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { hashPassword } from '../../shared/password.js'
import { UsersRepository } from '../users/users.repository.js'
import { publicUserSchema, toPublicUser } from '../users/users.schemas.js'
import { registerBodySchema } from './auth.schemas.js'
import { AuthService } from './auth.service.js'

export interface AuthRoutesOptions {
  /** Requests per minute per client on these routes. */
  rateLimitMax: number
}

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, options) => {
  const service = new AuthService({ users: new UsersRepository(app.db), hashPassword })
  const rateLimit = { max: options.rateLimitMax, timeWindow: '1 minute' }

  app.post(
    '/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Create an account',
        description:
          'CPF and phone are accepted with or without masks and stored as digits; the ' +
          'e-mail is stored lowercase. Answers 409 with code EMAIL_TAKEN or CPF_TAKEN ' +
          'when either is already registered.',
        body: registerBodySchema,
        response: {
          201: publicUserSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
      config: { rateLimit },
    },
    async (request, reply) => {
      const user = await service.register(request.body)
      return reply.status(201).send(toPublicUser(user))
    },
  )
}
