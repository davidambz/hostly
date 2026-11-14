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
  /** Starts a Stripe Checkout for a subscription: its id and the page to send the user to. */
  createCheckout(request: CheckoutRequest): Promise<{ id: string; url: string }>
  /**
   * Closes a checkout that is still open. Answers `complete` when it was already paid (its
   * webhook may not have arrived yet), `expired` otherwise.
   */
  expireCheckout(id: string): Promise<'complete' | 'expired'>
  /** Checks a webhook's signature and reads it; throws when it isn't Stripe's. */
  readWebhook(rawBody: Buffer, signature: string): Stripe.Event
  retrieveSubscription(id: string): Promise<Stripe.Subscription>
  /** Turns the renewal off (Premium lasts until the period's end) or back on. */
  setCancelAtPeriodEnd(id: string, cancel: boolean): Promise<Stripe.Subscription>
  /** Charges the subscription every `period` from now on, at `amount` cents. */
  changePeriod(
    id: string,
    change: {
      productName: string
      amount: number
      period: BillingPeriod
      metadata: CheckoutRequest['metadata']
    },
  ): Promise<Stripe.Subscription>
  /** Stripe's customer portal, where the user changes the card; returns its address. */
  createPortal(customerId: string, returnUrl: string): Promise<string>
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

  async createCheckout(request: CheckoutRequest): Promise<{ id: string; url: string }> {
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
    return { id: session.id, url: session.url }
  }

  async expireCheckout(id: string): Promise<'complete' | 'expired'> {
    const session = await this.stripe.checkout.sessions.retrieve(id)
    if (session.status === 'complete') return 'complete'
    if (session.status === 'open') await this.stripe.checkout.sessions.expire(id)
    return 'expired'
  }

  readWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
  }

  retrieveSubscription(id: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(id)
  }

  setCancelAtPeriodEnd(id: string, cancel: boolean): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(id, { cancel_at_period_end: cancel })
  }

  async changePeriod(
    id: string,
    change: {
      productName: string
      amount: number
      period: BillingPeriod
      metadata: CheckoutRequest['metadata']
    },
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(id)
    const item = subscription.items.data[0]
    if (!item) throw new Error(`Subscription ${id} has no item`)
    const { interval, intervalCount } = RECURRENCE[change.period]
    const product =
      typeof item.price.product === 'string' ? item.price.product : item.price.product.id
    return this.stripe.subscriptions.update(id, {
      items: [
        {
          id: item.id,
          price_data: {
            currency: 'brl',
            product,
            unit_amount: change.amount,
            recurring: { interval, interval_count: intervalCount },
          },
        },
      ],
      // A new interval restarts the billing cycle now (Stripe does that on its own when the
      // interval changes), with what was left of the old period credited.
      proration_behavior: 'create_prorations',
      metadata: change.metadata,
    })
  }

  async createPortal(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return session.url
  }
}
