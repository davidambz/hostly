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

/** Carried by the subscription, so webhooks know whose and which plan it is. */
export interface SubscriptionMetadata {
  userId: string
  planId: string
  period: BillingPeriod
}

export interface SubscriptionRequest {
  customerId: string
  /** The plan's product at Stripe. */
  productId: string
  /** Cents, in reais. */
  amount: number
  period: BillingPeriod
  metadata: SubscriptionMetadata
}

/** The card a subscription is charged on, as the user can tell it apart. Never the number. */
export interface SavedCard {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

/**
 * What the API asks of the payment provider. Stripe in production; a fake in tests, so they
 * run without the network and decide what Stripe "answers".
 */
export interface BillingGateway {
  createCustomer(user: { id: string; name: string; email: string }): Promise<string>
  /** The plan's product at Stripe (shown on receipts); returns its id. */
  createProduct(plan: { id: string; name: string }): Promise<string>
  /**
   * A subscription waiting for its first payment, and the secret the card form uses to pay
   * it. Stripe activates it once the card is charged; the webhook tells the API.
   */
  createSubscription(
    request: SubscriptionRequest,
  ): Promise<{ subscription: Stripe.Subscription; clientSecret: string }>
  /** Cancels a subscription at once (one left waiting for a payment that never came). */
  cancelSubscription(id: string): Promise<void>
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
      metadata: SubscriptionMetadata
    },
  ): Promise<Stripe.Subscription>
  /** Starts saving a new card for the customer; the card form completes it with the secret. */
  createCardSetup(customerId: string): Promise<string>
  /**
   * Charges the subscription (and the customer's next invoices) on a card the form saved.
   * False when the card isn't the customer's.
   */
  useCard(customerId: string, subscriptionId: string, paymentMethodId: string): Promise<boolean>
  /** The card the subscription is charged on, if any. */
  currentCard(customerId: string, subscriptionId: string): Promise<SavedCard | null>
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

  async createProduct(plan: { id: string; name: string }): Promise<string> {
    const product = await this.stripe.products.create({
      name: `Hostly ${plan.name}`,
      metadata: { planId: plan.id },
    })
    return product.id
  }

  async createSubscription(
    request: SubscriptionRequest,
  ): Promise<{ subscription: Stripe.Subscription; clientSecret: string }> {
    const { interval, intervalCount } = RECURRENCE[request.period]
    const subscription = await this.stripe.subscriptions.create({
      customer: request.customerId,
      items: [
        {
          price_data: {
            currency: 'brl',
            product: request.productId,
            unit_amount: request.amount,
            recurring: { interval, interval_count: intervalCount },
          },
        },
      ],
      // Waits for the card form to pay the first invoice; the card then pays the renewals.
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: { ...request.metadata },
      expand: ['latest_invoice.confirmation_secret'],
    })
    const invoice = subscription.latest_invoice
    const clientSecret =
      invoice && typeof invoice !== 'string' ? invoice.confirmation_secret?.client_secret : null
    if (!clientSecret) throw new Error('Stripe gave the subscription no payment to confirm')
    return { subscription, clientSecret }
  }

  async cancelSubscription(id: string): Promise<void> {
    await this.stripe.subscriptions.cancel(id)
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
      metadata: SubscriptionMetadata
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
      metadata: { ...change.metadata },
    })
  }

  async createCardSetup(customerId: string): Promise<string> {
    const intent = await this.stripe.setupIntents.create({
      customer: customerId,
      // Saved to be charged later, at each renewal, without the user there.
      usage: 'off_session',
    })
    if (!intent.client_secret) throw new Error('Stripe gave the setup no secret')
    return intent.client_secret
  }

  async useCard(
    customerId: string,
    subscriptionId: string,
    paymentMethodId: string,
  ): Promise<boolean> {
    const card = await this.stripe.paymentMethods.retrieve(paymentMethodId)
    const owner = typeof card.customer === 'string' ? card.customer : card.customer?.id
    if (owner !== customerId) return false
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })
    await this.stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    })
    return true
  }

  async currentCard(customerId: string, subscriptionId: string): Promise<SavedCard | null> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method'],
    })
    let method = subscription.default_payment_method
    if (!method || typeof method === 'string') {
      const customer = await this.stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      })
      method = customer.deleted ? null : customer.invoice_settings.default_payment_method
    }
    const card = method && typeof method !== 'string' ? method.card : null
    return card
      ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year }
      : null
  }
}
