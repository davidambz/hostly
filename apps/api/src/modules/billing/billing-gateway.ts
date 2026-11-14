import Stripe from 'stripe'

import type { BillingPeriod } from '../../generated/prisma/client.js'

/** How each billing period recurs at Stripe. */
export const RECURRENCE: Record<
  BillingPeriod,
  { interval: 'month' | 'year'; intervalCount: number }
> = {
  MONTHLY: { interval: 'month', intervalCount: 1 },
  SEMIANNUAL: { interval: 'month', intervalCount: 6 },
  ANNUAL: { interval: 'year', intervalCount: 1 },
}

export interface CheckoutRequest {
  customerId: string
  /** Shown on the Stripe page and the receipts. */
  productName: string
  /** Cents, in reais. */
  amount: number
  period: BillingPeriod
  /** Carried to the subscription, so webhooks know whose and which plan it is. */
  metadata: { userId: string; planId: string; period: BillingPeriod }
  successUrl: string
  cancelUrl: string
}

/**
 * What the API asks of the payment provider. Stripe in production; a fake in tests, so they
 * run without the network and decide what Stripe "answers".
 */
export interface BillingGateway {
  createCustomer(user: { id: string; name: string; email: string }): Promise<string>
  /** Starts a Stripe Checkout for a subscription; returns the page to send the user to. */
  createCheckout(request: CheckoutRequest): Promise<string>
  /** Checks a webhook's signature and reads it; throws when it isn't Stripe's. */
  readWebhook(rawBody: Buffer, signature: string): Stripe.Event
  retrieveSubscription(id: string): Promise<Stripe.Subscription>
}

export class StripeGateway implements BillingGateway {
  private readonly stripe: Stripe

  constructor(
    secretKey: string,
    private readonly webhookSecret: string | undefined,
  ) {
    this.stripe = new Stripe(secretKey)
  }

  async createCustomer(user: { id: string; name: string; email: string }): Promise<string> {
    const customer = await this.stripe.customers.create({
      name: user.name,
      email: user.email,
      metadata: { userId: user.id },
    })
    return customer.id
  }

  async createCheckout(request: CheckoutRequest): Promise<string> {
    const { interval, intervalCount } = RECURRENCE[request.period]
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: request.customerId,
      client_reference_id: request.metadata.userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: request.amount,
            product_data: { name: request.productName },
            recurring: { interval, interval_count: intervalCount },
          },
        },
      ],
      metadata: request.metadata,
      subscription_data: { metadata: request.metadata },
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    })
    if (!session.url) throw new Error('Stripe gave the checkout session no URL')
    return session.url
  }

  readWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
  }

  retrieveSubscription(id: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(id)
  }
}
