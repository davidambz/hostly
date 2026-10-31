import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import { UnauthorizedError } from '../shared/errors.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    user: { sub: string }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler for protected routes: requires a valid `Authorization: Bearer` token. */
    authenticate: (request: FastifyRequest) => Promise<void>
  }
}

export interface AuthPluginOptions {
  jwtSecret: string
  accessTokenTtlSeconds: number
}

function isJwtError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error
}

const auth: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  await app.register(cookie)
  await app.register(jwt, {
    secret: options.jwtSecret,
    sign: { algorithm: 'HS256', expiresIn: options.accessTokenTtlSeconds },
    verify: { algorithms: ['HS256'] },
  })

  app.decorate('authenticate', async (request: FastifyRequest) => {
    // Auth schemes are case-insensitive (RFC 7235); jwtVerify parses it the same way.
    if (!/^bearer\s+\S/i.test(request.headers.authorization ?? '')) {
      throw new UnauthorizedError('Missing access token')
    }
    try {
      await request.jwtVerify()
    } catch (error) {
      // TOKEN_EXPIRED tells the client to refresh; any other failure means a bad token.
      if (isJwtError(error) && error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        throw new UnauthorizedError('Access token expired', { code: 'TOKEN_EXPIRED' })
      }
      throw new UnauthorizedError('Invalid access token', { code: 'INVALID_TOKEN' })
    }
  })
}

export default fp(auth, { name: 'auth' })
