import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { Plan, User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
import { FakeBilling, stripeEvent, stripeSubscription } from '../../test/fake-billing.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let billing: FakeBilling
let user: User
let premium: Plan

beforeEach(async () => {
  billing = new FakeBilling()
  app = await buildApp(testEnv({ APP_URL: 'https://app.hostly.test' }), { db, billing })
  user = await createUser(db, { name: 'Ana Souza', email: 'ana@hostly.test' })
  premium = await db.plan.update({
    where: { code: 'premium' },
    data: { monthlyPrice: 3990, annualPrice: 38300 },
  })
})

afterEach(async () => {
  await app.close()
})

function checkout(body: object, as: User = user) {
  return app.inject({
    method: 'POST',
    url: '/billing/checkout',
    payload: body,
    headers: authHeader(app, as.id),
  })
}

function webhook(payload: string, signature = billing.sign(payload)) {
  return app.inject({
    method: 'POST',
    url: '/billing/webhook',
    payload,
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
  })
}

const metadata = () => ({ userId: user.id, planId: premium.id, period: 'MONTHLY' })

const planOf = async () =>
  (await app.inject({ method: 'GET', url: '/me/plan', headers: authHeader(app, user.id) })).json<{
    plan: { code: string }
    source: string
    subscription: { period: string; cancelAtPeriodEnd: boolean } | null
  }>()

describe('POST /billing/checkout', () => {
  it('opens a Stripe checkout for the plan and period, creating the customer once', async () => {
    const first = await checkout({ planId: premium.id, period: 'MONTHLY' })
    await checkout({ planId: premium.id, period: 'ANNUAL' })

    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
    expect(billing.customers).toEqual([
      expect.objectContaining({ id: user.id, email: 'ana@hostly.test' }),
    ])
    expect(billing.checkouts).toEqual([
      {
        customerId: 'cus_1',
        productName: 'Hostly Premium',
        amount: 3990,
        period: 'MONTHLY',
        metadata: { userId: user.id, planId: premium.id, period: 'MONTHLY' },
        successUrl: 'https://app.hostly.test/plano?assinatura=confirmando',
        cancelUrl: 'https://app.hostly.test/plano',
      },
      expect.objectContaining({ customerId: 'cus_1', amount: 38300, period: 'ANNUAL' }),
    ])
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).stripeCustomerId).toBe(
      'cus_1',
    )
  })

  it.each([
    ['a period without a price', 'premium', 'SEMIANNUAL', 'PERIOD_NOT_OFFERED'],
    ['Free', 'free', 'MONTHLY', 'PLAN_NOT_FOR_SALE'],
  ])('answers 400 for %s', async (_case, code, period, error) => {
    const plan = await db.plan.findUniqueOrThrow({ where: { code } })

    const response = await checkout({ planId: plan.id, period })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: error })
    expect(billing.checkouts).toHaveLength(0)
  })

  it('answers 409 SUBSCRIPTION_EXISTS while a paid plan runs', async () => {
    await db.subscription.create({
      data: {
        userId: user.id,
        planId: premium.id,
        period: 'MONTHLY',
        status: 'active',
        stripeSubscriptionId: 'sub_running',
      },
    })

    expect((await checkout({ planId: premium.id, period: 'ANNUAL' })).json()).toMatchObject({
      code: 'SUBSCRIPTION_EXISTS',
    })
  })

  it('answers 401 without a token, and 503 BILLING_UNAVAILABLE without Stripe', async () => {
    const noStripe = await buildApp(testEnv(), { db })
    try {
      const response = await noStripe.inject({
        method: 'POST',
        url: '/billing/checkout',
        payload: { planId: premium.id, period: 'MONTHLY' },
        headers: authHeader(noStripe, user.id),
      })
      expect(response.statusCode).toBe(503)
      expect(response.json()).toMatchObject({ code: 'BILLING_UNAVAILABLE' })
    } finally {
      await noStripe.close()
    }
    expect(
      (await app.inject({ method: 'POST', url: '/billing/checkout', payload: {} })).statusCode,
    ).toBe(401)
  })
})

describe('POST /billing/webhook', () => {
  it('refuses an event Stripe did not sign', async () => {
    const payload = stripeEvent('evt_1', 'customer.subscription.created', stripeSubscription())

    const response = await webhook(payload, 't=1,v1=forged')

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_SIGNATURE' })
  })

  it('gives the plan once the checkout completes', async () => {
    billing.subscriptions.set('sub_1', stripeSubscription({ metadata: metadata() }))

    const response = await webhook(
      stripeEvent('evt_1', 'checkout.session.completed', { subscription: 'sub_1' }),
    )

    expect(response.statusCode).toBe(200)
    expect(await planOf()).toMatchObject({
      plan: { code: 'premium' },
      source: 'SUBSCRIPTION',
      subscription: { period: 'MONTHLY', cancelAtPeriodEnd: false },
    })
  })

  it('applies an event once, however many times it arrives', async () => {
    const payload = stripeEvent(
      'evt_same',
      'customer.subscription.created',
      stripeSubscription({ metadata: metadata() }),
    )

    await webhook(payload)
    await webhook(payload)

    expect(await db.subscription.count()).toBe(1)
    expect(await db.stripeEvent.count()).toBe(1)
  })

  it('takes the plan away at once when a payment fails, and records the charge', async () => {
    await webhook(
      stripeEvent(
        'evt_1',
        'customer.subscription.created',
        stripeSubscription({ metadata: metadata() }),
      ),
    )
    await webhook(
      stripeEvent('evt_2', 'invoice.paid', {
        id: 'in_1',
        customer: 'cus_x',
        amount_paid: 3990,
        amount_due: 3990,
        created: 1_800_000_000,
        parent: { subscription_details: { subscription: 'sub_1' } },
      }),
    )
    expect((await planOf()).plan.code).toBe('premium')

    await webhook(
      stripeEvent('evt_3', 'invoice.payment_failed', {
        id: 'in_2',
        customer: 'cus_x',
        amount_paid: 0,
        amount_due: 3990,
        created: 1_802_000_000,
        parent: { subscription_details: { subscription: 'sub_1' } },
      }),
    )

    expect(await planOf()).toMatchObject({ plan: { code: 'free' }, source: 'FREE' })
    const payments = await db.billingPayment.findMany({ orderBy: { at: 'asc' } })
    expect(payments.map((payment) => [payment.amount, payment.status])).toEqual([
      [3990, 'paid'],
      [3990, 'failed'],
    ])
  })

  it('keeps the plan until the end of the paid period after a cancellation, then Free', async () => {
    await webhook(
      stripeEvent(
        'evt_1',
        'customer.subscription.created',
        stripeSubscription({ metadata: metadata() }),
      ),
    )
    await webhook(
      stripeEvent(
        'evt_2',
        'customer.subscription.updated',
        stripeSubscription({ metadata: metadata(), cancelAtPeriodEnd: true }),
      ),
    )
    expect(await planOf()).toMatchObject({
      plan: { code: 'premium' },
      subscription: { cancelAtPeriodEnd: true },
    })

    await webhook(
      stripeEvent(
        'evt_3',
        'customer.subscription.deleted',
        stripeSubscription({ metadata: metadata(), status: 'canceled' }),
      ),
    )

    expect((await planOf()).source).toBe('FREE')
  })

  it('ignores events it does not use, and subscriptions it can not place', async () => {
    const other = await webhook(stripeEvent('evt_1', 'customer.created', { id: 'cus_1' }))
    const anonymous = await webhook(
      stripeEvent('evt_2', 'customer.subscription.created', stripeSubscription()),
    )

    expect(other.statusCode).toBe(200)
    expect(anonymous.statusCode).toBe(200)
    expect(await db.subscription.count()).toBe(0)
  })

  it('lets the paid plan count in the backoffice, behind a grant', async () => {
    await webhook(
      stripeEvent(
        'evt_1',
        'customer.subscription.created',
        stripeSubscription({ metadata: metadata() }),
      ),
    )
    const admin = await createUser(db)
    await db.user.update({ where: { id: admin.id }, data: { isAdmin: true } })

    const dashboard = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: authHeader(app, admin.id),
    })

    expect(dashboard.json()).toMatchObject({
      bySource: { free: 1, grant: 0, subscription: 1 },
    })
  })
})
