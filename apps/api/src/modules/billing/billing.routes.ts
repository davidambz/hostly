import type { FastifyPluginAsync } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { errorResponseSchema } from '../../shared/error-response.js'
import { BadRequestError, ServiceUnavailableError } from '../../shared/errors.js'
import type { BillingGateway } from './billing-gateway.js'
import { BillingService } from './billing.service.js'

export interface BillingRoutesOptions {
  /** Null when Stripe isn't configured: paying answers 503 BILLING_UNAVAILABLE. */
  gateway: BillingGateway | null
  /** Stripe's publishable key, for the card form. */
  publishableKey?: string
}

const unavailable = () =>
  new ServiceUnavailableError('Payments are not set up', { code: 'BILLING_UNAVAILABLE' })

/** Paying for a plan with Stripe, and Stripe telling the API what happened. */
export const billingRoutes: FastifyPluginAsyncZod<BillingRoutesOptions> = async (app, options) => {
  const service = options.gateway ? new BillingService(app.db, options.gateway) : null

  app.get(
    '/config',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'What the card form needs',
        description:
          "Stripe's publishable key, for the card form in the browser. 503 BILLING_UNAVAILABLE " +
          'without Stripe.',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ publishableKey: z.string() }),
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async () => {
      if (!service || !options.publishableKey) throw unavailable()
      return { publishableKey: options.publishableKey }
    },
  )

  app.post(
    '/subscribe',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'Start paying for a plan',
        description:
          'Creates the subscription waiting for its first charge and answers the secret the ' +
          "card form confirms it with (Stripe's Payment Element). The card never reaches this " +
          'API. A subscription still waiting for a payment is cancelled first. 409 ' +
          'SUBSCRIPTION_EXISTS while a paid plan runs; 400 PLAN_NOT_FOR_SALE, ' +
          'PERIOD_NOT_OFFERED; 503 BILLING_UNAVAILABLE without Stripe.',
        security: [{ bearerAuth: [] }],
        body: z.object({
          planId: z.uuid(),
          period: z.enum(['MONTHLY', 'SEMIANNUAL', 'ANNUAL']),
        }),
        response: {
          200: z.object({ clientSecret: z.string() }),
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
      return service.subscribe(request.user.sub, request.body.planId, request.body.period)
    },
  )

  const periodSchema = z.enum(['MONTHLY', 'SEMIANNUAL', 'ANNUAL'])
  const ok = {
    204: z.null(),
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    503: errorResponseSchema,
  }

  app.post(
    '/subscription/renewal',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'Cancel or resume the renewal',
        description:
          '`renew: false` cancels the renewal: the plan lasts until the end of the period paid. ' +
          '`renew: true` undoes it. 404 NO_SUBSCRIPTION without a paid plan.',
        security: [{ bearerAuth: [] }],
        body: z.object({ renew: z.boolean() }),
        response: ok,
      },
    },
    async (request, reply) => {
      if (!service) throw unavailable()
      await service.setRenewal(request.user.sub, request.body.renew)
      return reply.status(204).send(null)
    },
  )

  app.get(
    '/subscription/period/preview',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'What a period change would charge now',
        description:
          'In cents: the new period, less what is left of the current one. Changes nothing. ' +
          '400 SAME_PERIOD, PERIOD_NOT_OFFERED; 404 NO_SUBSCRIPTION.',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ period: periodSchema }),
        response: {
          200: z.object({ amountDue: z.number().int() }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request) => {
      if (!service) throw unavailable()
      return service.previewPeriod(request.user.sub, request.query.period)
    },
  )

  app.post(
    '/subscription/period',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'Change the billing period',
        description:
          "From now, at that period's price, with what was left of the current one credited. " +
          '400 SAME_PERIOD, PERIOD_NOT_OFFERED; 404 NO_SUBSCRIPTION.',
        security: [{ bearerAuth: [] }],
        body: z.object({ period: periodSchema }),
        response: ok,
      },
    },
    async (request, reply) => {
      if (!service) throw unavailable()
      await service.changePeriod(request.user.sub, request.body.period)
      return reply.status(204).send(null)
    },
  )

  const cardSchema = z
    .object({
      brand: z.string().describe('visa, mastercard, amex…'),
      last4: z.string(),
      expMonth: z.number().int(),
      expYear: z.number().int(),
    })
    .meta({ id: 'SavedCard' })

  app.get(
    '/card',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'The card the subscription is charged on',
        description:
          'Brand, last four digits and expiry; never the number. 404 NO_SUBSCRIPTION without a ' +
          'paid plan.',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ card: cardSchema.nullable() }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request) => {
      if (!service) throw unavailable()
      return { card: await service.card(request.user.sub) }
    },
  )

  app.post(
    '/card/setup',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'Start saving a new card',
        description:
          "Answers the secret the card form (Stripe's Payment Element) saves the card with; the " +
          'card goes to Stripe, never to this API. 404 NO_SUBSCRIPTION without a paid plan.',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ clientSecret: z.string() }),
          401: errorResponseSchema,
          404: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request) => {
      if (!service) throw unavailable()
      return service.cardSetup(request.user.sub)
    },
  )

  app.put(
    '/card',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'Charge the subscription on the card just saved',
        description:
          '`paymentMethodId` is the card the form saved. 400 INVALID_PAYMENT_METHOD when it is ' +
          "not this account's; 404 NO_SUBSCRIPTION without a paid plan.",
        security: [{ bearerAuth: [] }],
        body: z.object({ paymentMethodId: z.string().startsWith('pm_').max(255) }),
        response: ok,
      },
    },
    async (request, reply) => {
      if (!service) throw unavailable()
      await service.setCard(request.user.sub, request.body.paymentMethodId)
      return reply.status(204).send(null)
    },
  )

  app.get(
    '/payments',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['billing'],
        summary: 'My charges',
        description:
          'Newest first: amount in cents, paid or failed, and for which plan and period.',
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(
            z
              .object({
                id: z.uuid(),
                amount: z.number().int(),
                status: z.enum(['paid', 'failed']),
                at: z.iso.datetime(),
                plan: z.string().nullable(),
                period: periodSchema.nullable(),
              })
              .meta({ id: 'BillingPayment' }),
          ),
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const payments = await app.db.billingPayment.findMany({
        where: { userId: request.user.sub },
        include: { subscription: { select: { period: true, plan: { select: { name: true } } } } },
        orderBy: { at: 'desc' },
      })
      return payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status as 'paid' | 'failed',
        at: payment.at.toISOString(),
        plan: payment.subscription?.plan.name ?? null,
        period: payment.subscription?.period ?? null,
      }))
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
