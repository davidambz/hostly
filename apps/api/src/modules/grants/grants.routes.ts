import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { userIdParamsSchema } from '../admin/admin.schemas.js'
import {
  changeGrantPlanBodySchema,
  createGrantBodySchema,
  grantIdParamsSchema,
  grantSchema,
  renewGrantBodySchema,
  revokeGrantBodySchema,
} from './grants.schemas.js'
import { GrantsService } from './grants.service.js'

const tags = ['admin']
const security = [{ bearerAuth: [] }]
const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
}

/** Grants in the backoffice. Registered inside the admin routes, behind their checks. */
export const grantsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new GrantsService(app.db)

  app.get(
    '/users/:id/grants',
    {
      schema: {
        tags,
        security,
        summary: "A user's plan grants",
        description: 'Newest first, each with its history (who, when, what and why).',
        params: userIdParamsSchema,
        response: { 200: z.array(grantSchema), ...errors },
      },
    },
    async (request) => service.list(request.params.id),
  )

  app.post(
    '/users/:id/grants',
    {
      schema: {
        tags,
        security,
        summary: 'Give a user a plan',
        description:
          'For 1 month, 6 months, 1 year or LIFETIME, from now, free of charge. 409 ' +
          'ACTIVE_GRANT_EXISTS when one is in force; 400 CANNOT_GRANT_FREE, PLAN_INACTIVE.',
        params: userIdParamsSchema,
        body: createGrantBodySchema,
        response: { 201: grantSchema, ...errors, 409: errorResponseSchema },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await service.grant(request.user.sub, request.params.id, request.body)),
  )

  app.post(
    '/grants/:id/renew',
    {
      schema: {
        tags,
        security,
        summary: 'Renew a grant',
        description: 'Extends it by the duration, from its end (or from now, if it is over).',
        params: grantIdParamsSchema,
        body: renewGrantBodySchema,
        response: { 200: grantSchema, ...errors, 409: errorResponseSchema },
      },
    },
    async (request) => service.renew(request.user.sub, request.params.id, request.body),
  )

  app.patch(
    '/grants/:id/plan',
    {
      schema: {
        tags,
        security,
        summary: "Change a grant's plan",
        description: 'Keeps its dates. 409 GRANT_REVOKED for a revoked grant.',
        params: grantIdParamsSchema,
        body: changeGrantPlanBodySchema,
        response: { 200: grantSchema, ...errors, 409: errorResponseSchema },
      },
    },
    async (request) => service.changePlan(request.user.sub, request.params.id, request.body),
  )

  app.post(
    '/grants/:id/revoke',
    {
      schema: {
        tags,
        security,
        summary: 'Revoke a grant',
        description: 'Ends it now. 409 GRANT_REVOKED when it already was.',
        params: grantIdParamsSchema,
        body: revokeGrantBodySchema,
        response: { 200: grantSchema, ...errors, 409: errorResponseSchema },
      },
    },
    async (request) => service.revoke(request.user.sub, request.params.id, request.body.reason),
  )
}
