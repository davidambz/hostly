import type { FastifyPluginAsync } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { BadRequestError, ServiceUnavailableError } from '../../shared/errors.js'
import type { BillingGateway } from './billing-gateway.js'
import { BillingService } from './billing.service.js'

export interface BillingRoutesOptions {
  /** Null when Stripe isn't configured: checkout answers 503 BILLING_UNAVAILABLE. */
  gateway: BillingGateway | null
  appUrl: string
}

const unavailable = () =>
  new ServiceUnavailableError('Payments are not set up', { code: 'BILLING_UNAVAILABLE' })

/** Paying for a plan with Stripe, and Stripe telling the API what happened. */
export const billingRoutes: FastifyPluginAsyncZod<BillingRoutesOptions> = async (app, options) => {
  const service = options.gateway
    ? new BillingService(app.db, options.gateway, options.appUrl)
    : null

  app.post(
    '/checkout',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'Start paying for a plan',
        description:
          'Answers the Stripe Checkout page to send the user to. 409 SUBSCRIPTION_EXISTS while a ' +
          'paid plan runs; 400 PLAN_NOT_FOR_SALE, PERIOD_NOT_OFFERED; 503 BILLING_UNAVAILABLE ' +
          'without Stripe.',
        security: [{ bearerAuth: [] }],
        body: z.object({
          planId: z.uuid(),
          period: z.enum(['MONTHLY', 'SEMIANNUAL', 'ANNUAL']),
        }),
        response: {
          200: z.object({ url: z.url() }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request) => {
      if (!service) throw unavailable()
      return {
        url: await service.checkout(request.user.sub, request.body.planId, request.body.period),
      }
    },
  )

  await app.register(webhookRoute(service, options.gateway))
}

/**
 * Stripe's webhook. Its signature is checked against the body exactly as sent, so this route
 * lives in its own scope where JSON arrives as raw bytes.
 */
function webhookRoute(
  service: BillingService | null,
  gateway: BillingGateway | null,
): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body)
    })

    app.post(
      '/webhook',
      {
        schema: {
          tags: ['billing'],
          summary: "Stripe's events",
          description:
            'Called by Stripe, signed with STRIPE_WEBHOOK_SECRET; 400 INVALID_SIGNATURE otherwise. ' +
            'Each event is applied once, however many times it arrives.',
        },
      },
      async (request) => {
        if (!service || !gateway) throw unavailable()
        const signature = request.headers['stripe-signature']
        let event
        try {
          event = gateway.readWebhook(request.body as Buffer, String(signature ?? ''))
        } catch {
          throw new BadRequestError('Not a valid Stripe webhook', { code: 'INVALID_SIGNATURE' })
        }
        await service.handle(event)
        return { received: true }
      },
    )
  }
}
