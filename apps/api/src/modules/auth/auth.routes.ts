import type { FastifyReply } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { UnauthorizedError } from '../../shared/errors.js'
import { hashPassword, verifyPassword } from '../../shared/password.js'
import { UsersRepository } from '../users/users.repository.js'
import { publicUserSchema, toPublicUser } from '../users/users.schemas.js'
import {
  accessTokenSchema,
  loginBodySchema,
  loginResponseSchema,
  registerBodySchema,
} from './auth.schemas.js'
import { AuthService, type Session } from './auth.service.js'
import { RefreshTokensRepository } from './refresh-tokens.repository.js'

export const REFRESH_COOKIE = 'hostly_refresh_token'
/** The cookie only travels to the auth routes, never to the rest of the API. */
const REFRESH_COOKIE_PATH = '/auth'

export interface AuthRoutesOptions {
  /** Requests per minute per client on signup and login. */
  rateLimitMax: number
  accessTokenTtlSeconds: number
  refreshTokenTtlDays: number
  cookieSecure: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, options) => {
  const service = new AuthService({
    users: new UsersRepository(app.db),
    refreshTokens: new RefreshTokensRepository(app.db),
    hashPassword,
    verifyPassword,
    signAccessToken: (userId) => app.jwt.sign({ sub: userId }),
    refreshTokenTtlMs: options.refreshTokenTtlDays * DAY_MS,
  })
  const rateLimit = { max: options.rateLimitMax, timeWindow: '1 minute' }
  const cookieOptions = {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: options.cookieSecure,
    // The SPA and the API share a site, so the cookie never has to go cross-site,
    // which also keeps it out of reach of CSRF.
    sameSite: 'strict',
  } as const

  function startSession(reply: FastifyReply, session: Session) {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      ...cookieOptions,
      expires: session.refreshTokenExpiresAt,
    })
    return {
      accessToken: session.accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: options.accessTokenTtlSeconds,
    }
  }

  function endSession(reply: FastifyReply) {
    reply.clearCookie(REFRESH_COOKIE, cookieOptions)
  }

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

  app.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Log in',
        description:
          'Returns a short-lived access token (send it as `Authorization: Bearer`) and ' +
          'sets the refresh token in an httpOnly cookie. Wrong e-mail and wrong password ' +
          'both answer 401 INVALID_CREDENTIALS.',
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
      config: { rateLimit },
    },
    async (request, reply) => {
      const { user, session } = await service.login(request.body)
      return { ...startSession(reply, session), user: toPublicUser(user) }
    },
  )

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Get a new access token',
        description:
          'Uses the refresh token cookie and rotates it. 401 codes: INVALID_REFRESH_TOKEN, ' +
          'REFRESH_TOKEN_EXPIRED, REFRESH_TOKEN_REUSED (the session was revoked because an ' +
          'old token was presented again). The cookie is cleared on any 401.',
        response: { 200: accessTokenSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE]
      try {
        if (!token) {
          throw new UnauthorizedError('Missing refresh token', { code: 'INVALID_REFRESH_TOKEN' })
        }
        return startSession(reply, await service.refresh(token))
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          endSession(reply)
        }
        throw error
      }
    },
  )

  app.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Log out',
        description: 'Revokes the session of the refresh token cookie and clears it.',
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.logout(request.cookies[REFRESH_COOKIE])
      endSession(reply)
      return reply.status(204).send(null)
    },
  )
}
