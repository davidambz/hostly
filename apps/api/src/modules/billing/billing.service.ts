import type Stripe from 'stripe'

import type { BillingPeriod } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import { FREE_PLAN } from '../plans/system-plans.js'
import type { BillingGateway } from './billing-gateway.js'
import { PAYING_STATUSES } from './paying-statuses.js'

const PRICE_OF: Record<BillingPeriod, 'monthlyPrice' | 'semiannualPrice' | 'annualPrice'> = {
  MONTHLY: 'monthlyPrice',
  SEMIANNUAL: 'semiannualPrice',
  ANNUAL: 'annualPrice',
}

const PERIODS = new Set<string>(['MONTHLY', 'SEMIANNUAL', 'ANNUAL'])

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : (value?.id ?? null)

/** When the paid period ends: the soonest end among the subscription's items. */
function periodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data.map((item) => item.current_period_end)
  return ends.length > 0 ? new Date(Math.min(...ends) * 1000) : null
}

export class BillingService {
  constructor(
    private readonly db: Database,
    private readonly gateway: BillingGateway,
    private readonly appUrl: string,
  ) {}

  /**
   * Starts paying for `planId` every `period`: returns the Stripe page to send the user to.
   * 409 SUBSCRIPTION_EXISTS while a paid plan is running; 400 PLAN_NOT_FOR_SALE (Free, off
   * sale) and PERIOD_NOT_OFFERED (no price for that period).
   */
  async checkout(userId: string, planId: string, period: BillingPeriod): Promise<string> {
    const plan = await this.db.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      throw new NotFoundError('Plan not found', {
        code: 'PLAN_NOT_FOUND',
        details: { field: 'planId' },
      })
    }
    if (plan.code === FREE_PLAN || !plan.active) {
      throw new BadRequestError('This plan is not for sale', {
        code: 'PLAN_NOT_FOR_SALE',
        details: { field: 'planId' },
      })
    }
    const amount = plan[PRICE_OF[period]]
    if (amount === null || amount === 0) {
      throw new BadRequestError('The plan is not offered for this period', {
        code: 'PERIOD_NOT_OFFERED',
        details: { field: 'period' },
      })
    }

    // One checkout at a time per user, with the user's row locked: two tabs (or a double
    // click) would otherwise create two customers and two checkouts, and paying both would
    // charge two subscriptions. Opening one expires the previous one.
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
        const running = await tx.subscription.findFirst({
          where: { userId, status: { in: PAYING_STATUSES } },
        })
        const previous = user.stripeCheckoutSessionId
        // A previous checkout already paid means a subscription whose webhook is on its way.
        if (running || (previous && (await this.gateway.expireCheckout(previous)) === 'complete')) {
          throw new ConflictError('A paid plan is already running', {
            code: 'SUBSCRIPTION_EXISTS',
          })
        }

        const customerId = user.stripeCustomerId ?? (await this.gateway.createCustomer(user))
        const session = await this.gateway.createCheckout({
          customerId,
          productName: `Hostly ${plan.name}`,
          amount,
          period,
          metadata: { userId, planId, period },
          successUrl: `${this.appUrl}/plano?assinatura=confirmando`,
          cancelUrl: `${this.appUrl}/plano`,
        })
        await tx.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId, stripeCheckoutSessionId: session.id },
        })
        return session.url
      },
      // Stripe answers inside the transaction, so it gets more than the default 5 s.
      { timeout: 30_000 },
    )
  }

  /** The subscription that gives the user a paid plan now; 404 NO_SUBSCRIPTION without one. */
  private async running(userId: string) {
    const subscription = await this.db.subscription.findFirst({
      where: { userId, status: { in: PAYING_STATUSES } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!subscription) {
      throw new NotFoundError('No paid plan is running', { code: 'NO_SUBSCRIPTION' })
    }
    return subscription
  }

  /**
   * Cancels the renewal (`cancel`) or turns it back on. The plan stays until the end of the
   * period already paid; the local record follows at once, and Stripe's webhook confirms it.
   */
  async setRenewal(userId: string, renew: boolean): Promise<void> {
    const subscription = await this.running(userId)
    const updated = await this.gateway.setCancelAtPeriodEnd(
      subscription.stripeSubscriptionId,
      !renew,
    )
    await this.db.$transaction((tx) => this.saveSubscription(tx, updated))
  }

  /** Moves the subscription to another billing period, at that period's price. */
  async changePeriod(userId: string, period: BillingPeriod): Promise<void> {
    const subscription = await this.running(userId)
    if (subscription.period === period) {
      throw new BadRequestError('That is already the period', {
        code: 'SAME_PERIOD',
        details: { field: 'period' },
      })
    }
    const amount = subscription.plan[PRICE_OF[period]]
    if (amount === null || amount === 0) {
      throw new BadRequestError('The plan is not offered for this period', {
        code: 'PERIOD_NOT_OFFERED',
        details: { field: 'period' },
      })
    }
    const updated = await this.gateway.changePeriod(subscription.stripeSubscriptionId, {
      productName: `Hostly ${subscription.plan.name}`,
      amount,
      period,
      metadata: { userId, planId: subscription.planId, period },
    })
    await this.db.$transaction((tx) => this.saveSubscription(tx, updated))
  }

  /** Stripe's portal for the card; 404 NO_CUSTOMER for an account that never paid. */
  async portal(userId: string): Promise<string> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } })
    if (!user.stripeCustomerId) {
      throw new NotFoundError('The account never paid with Stripe', { code: 'NO_CUSTOMER' })
    }
    return this.gateway.createPortal(user.stripeCustomerId, `${this.appUrl}/plano`)
  }

  /**
   * Applies a Stripe event. The event's id is stored in the same transaction as its effect:
   * a webhook Stripe sends again is applied once, and one that fails is retried by Stripe.
   */
  async handle(event: Stripe.Event): Promise<void> {
    const seen = await this.db.stripeEvent.findUnique({ where: { id: event.id } })
    if (seen) return

    // Read from Stripe before the transaction: the network has no business inside one.
    const subscription = await this.subscriptionOf(event)

    try {
      await this.db.$transaction(async (tx) => {
        await tx.stripeEvent.create({ data: { id: event.id, type: event.type } })
        if (subscription) await this.saveSubscription(tx, subscription)
        if (event.type === 'checkout.session.completed') {
          // Paid: a new checkout no longer has this one to expire.
          const id = event.data.object.id
          if (typeof id === 'string') {
            await tx.user.updateMany({
              where: { stripeCheckoutSessionId: id },
              data: { stripeCheckoutSessionId: null },
            })
          }
        }
        if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
          await this.savePayment(tx, event.data.object, event.type === 'invoice.paid')
        }
      })
    } catch (error) {
      // The same event delivered twice at once: the other delivery applied it.
      if (await this.db.stripeEvent.findUnique({ where: { id: event.id } })) return
      throw error
    }
  }

  /**
   * The subscription an event is about, as Stripe has it now. Never the event's own copy:
   * Stripe doesn't deliver events in order, and an old `updated` arriving after `deleted`
   * would bring a cancelled subscription back to life.
   */
  private async subscriptionOf(event: Stripe.Event): Promise<Stripe.Subscription | null> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return this.gateway.retrieveSubscription(event.data.object.id)
      case 'checkout.session.completed': {
        const id = idOf(event.data.object.subscription)
        return id ? this.gateway.retrieveSubscription(id) : null
      }
      default:
        return null
    }
  }

  private async saveSubscription(tx: Transaction, subscription: Stripe.Subscription) {
    const { userId, planId, period } = subscription.metadata
    if (!userId || !planId || !period || !PERIODS.has(period)) return
    // The plan and the period follow the subscription's metadata, which a period change updates.
    const data = {
      planId,
      period: period as BillingPeriod,
      status: subscription.status,
      currentPeriodEnd: periodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
    await tx.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: { ...data, userId, stripeSubscriptionId: subscription.id },
      update: data,
    })
  }

  /**
   * Records a charge. A failed one takes the plan away at once (past_due): Premium is for
   * what is paid. Stripe follows with its own subscription update.
   */
  private async savePayment(tx: Transaction, invoice: Stripe.Invoice, paid: boolean) {
    const stripeSubscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
    const subscription = stripeSubscriptionId
      ? await tx.subscription.findUnique({ where: { stripeSubscriptionId } })
      : null
    const userId =
      subscription?.userId ??
      (await tx.user.findFirst({ where: { stripeCustomerId: idOf(invoice.customer) ?? '' } }))?.id
    if (!userId || !invoice.id) return

    // Events about the same invoice, one at a time: a paid invoice is final, so a failure
    // arriving after it (out of order, or at the same moment) changes nothing.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.id}))`
    const recorded = await tx.billingPayment.findUnique({
      where: { stripeInvoiceId: invoice.id },
      select: { status: true },
    })
    if (recorded?.status === 'paid') return

    await tx.billingPayment.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        userId,
        subscriptionId: subscription?.id ?? null,
        stripeInvoiceId: invoice.id,
        amount: paid ? invoice.amount_paid : invoice.amount_due,
        status: paid ? 'paid' : 'failed',
        at: new Date(invoice.created * 1000),
      },
      update: {
        status: paid ? 'paid' : 'failed',
        amount: paid ? invoice.amount_paid : invoice.amount_due,
      },
    })
    if (!paid && subscription) {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: 'past_due' } })
    }
  }
}

type Transaction = Parameters<Parameters<Database['$transaction']>[0]>[0]
