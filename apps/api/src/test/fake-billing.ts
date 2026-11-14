import Stripe from 'stripe'

import type {
  BillingGateway,
  SubscriptionMetadata,
  SubscriptionRequest,
} from '../modules/billing/billing-gateway.js'

export const TEST_WEBHOOK_SECRET = 'whsec_test_hostly'

/**
 * Stands in for Stripe: records what the API asks and answers what a test decides. Webhooks
 * are signed and checked with Stripe's own code, so the signature path is the real one.
 */
export class FakeBilling implements BillingGateway {
  readonly customers: { id: string; name: string; email: string }[] = []
  readonly products: { id: string; name: string }[] = []
  /** Every subscription asked for, in order (`sub_<n>`, each waiting for its payment). */
  readonly subscriptionRequests: SubscriptionRequest[] = []
  readonly cancelled: string[] = []
  readonly subscriptions = new Map<string, Stripe.Subscription>()
  private readonly stripe = new Stripe('sk_test_fake')

  createCustomer(user: { id: string; name: string; email: string }) {
    this.customers.push(user)
    return Promise.resolve(`cus_${String(this.customers.length)}`)
  }

  createProduct(plan: { id: string; name: string }) {
    this.products.push({ id: plan.id, name: plan.name })
    return Promise.resolve(`prod_${String(this.products.length)}`)
  }

  createSubscription(request: SubscriptionRequest) {
    this.subscriptionRequests.push(request)
    const n = this.subscriptionRequests.length
    const subscription = stripeSubscription({
      id: `sub_${String(n)}`,
      status: 'incomplete',
      metadata: { ...request.metadata },
    })
    this.subscriptions.set(subscription.id, subscription)
    return Promise.resolve({ subscription, clientSecret: `pi_${String(n)}_secret_test` })
  }

  cancelSubscription(id: string) {
    this.cancelled.push(id)
    const subscription = this.subscriptions.get(id)
    if (subscription) this.subscriptions.set(id, { ...subscription, status: 'canceled' })
    return Promise.resolve()
  }

  /**
   * An event about `subscription`, which is also how Stripe has it now: the API reads the
   * subscription back from Stripe instead of trusting the event's copy.
   */
  subscriptionEvent(id: string, type: string, subscription: Stripe.Subscription): string {
    this.subscriptions.set(subscription.id, subscription)
    return stripeEvent(id, type, subscription)
  }

  readWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, TEST_WEBHOOK_SECRET)
  }

  retrieveSubscription(id: string) {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return Promise.reject(new Error(`No subscription ${id}`))
    return Promise.resolve(subscription)
  }

  readonly periodChanges: { id: string; amount: number; period: string }[] = []

  setCancelAtPeriodEnd(id: string, cancel: boolean) {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return Promise.reject(new Error(`No subscription ${id}`))
    const updated = { ...subscription, cancel_at_period_end: cancel }
    this.subscriptions.set(id, updated)
    return Promise.resolve(updated)
  }

  changePeriod(
    id: string,
    change: { amount: number; period: string; metadata: SubscriptionMetadata },
  ) {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return Promise.reject(new Error(`No subscription ${id}`))
    this.periodChanges.push({ id, amount: change.amount, period: change.period })
    const updated = { ...subscription, metadata: { ...change.metadata } }
    this.subscriptions.set(id, updated)
    return Promise.resolve(updated)
  }

  createPortal(customerId: string, returnUrl: string) {
    return Promise.resolve(
      `https://billing.stripe.com/p/session/test_${customerId}?return=${encodeURIComponent(returnUrl)}`,
    )
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
