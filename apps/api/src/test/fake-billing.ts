import Stripe from 'stripe'

import type { BillingGateway, CheckoutRequest } from '../modules/billing/billing-gateway.js'

export const TEST_WEBHOOK_SECRET = 'whsec_test_hostly'

/**
 * Stands in for Stripe: records what the API asks and answers what a test decides. Webhooks
 * are signed and checked with Stripe's own code, so the signature path is the real one.
 */
export class FakeBilling implements BillingGateway {
  readonly customers: { id: string; name: string; email: string }[] = []
  readonly checkouts: CheckoutRequest[] = []
  readonly subscriptions = new Map<string, Stripe.Subscription>()
  private readonly stripe = new Stripe('sk_test_fake')

  createCustomer(user: { id: string; name: string; email: string }) {
    this.customers.push(user)
    return Promise.resolve(`cus_${String(this.customers.length)}`)
  }

  createCheckout(request: CheckoutRequest) {
    this.checkouts.push(request)
    return Promise.resolve(
      `https://checkout.stripe.com/c/pay/cs_test_${String(this.checkouts.length)}`,
    )
  }

  readWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, TEST_WEBHOOK_SECRET)
  }

  retrieveSubscription(id: string) {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return Promise.reject(new Error(`No subscription ${id}`))
    return Promise.resolve(subscription)
  }

  /** Signs `payload` the way Stripe signs its webhooks. */
  sign(payload: string): string {
    return this.stripe.webhooks.generateTestHeaderString({ payload, secret: TEST_WEBHOOK_SECRET })
  }
}

/** A Stripe subscription as the webhooks carry it, with what the API reads. */
export function stripeSubscription(
  overrides: {
    id?: string
    status?: Stripe.Subscription.Status
    cancelAtPeriodEnd?: boolean
    periodEnd?: Date
    metadata?: Record<string, string>
  } = {},
): Stripe.Subscription {
  const periodEnd = Math.floor(
    (overrides.periodEnd ?? new Date(Date.now() + 30 * 86_400_000)).getTime() / 1000,
  )
  return {
    id: overrides.id ?? 'sub_1',
    object: 'subscription',
    status: overrides.status ?? 'active',
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    metadata: overrides.metadata ?? {},
    items: { object: 'list', data: [{ current_period_end: periodEnd }], has_more: false, url: '' },
  } as unknown as Stripe.Subscription
}

/** A Stripe event of `type` about `object`. */
export function stripeEvent(id: string, type: string, object: unknown): string {
  return JSON.stringify({
    id,
    object: 'event',
    type,
    data: { object },
    created: 0,
    livemode: false,
  })
}
