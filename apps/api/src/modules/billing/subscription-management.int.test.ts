import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type App, buildApp } from '../../app.js'
import type { Plan, User } from '../../generated/prisma/client.js'
import { authHeader } from '../../test/auth.js'
import { testEnv } from '../../test/env.js'
import { createUser } from '../../test/factories.js'
import { FakeBilling, stripeSubscription } from '../../test/fake-billing.js'
import { testDatabase } from '../../test/integration/database.js'

const db = testDatabase()
let app: App
let billing: FakeBilling
let user: User
let premium: Plan

beforeEach(async () => {
  billing = new FakeBilling()
  app = await buildApp(testEnv({ APP_URL: 'https://app.hostly.test' }), { db, billing })
  user = await createUser(db)
  premium = await db.plan.update({
    where: { code: 'premium' },
    data: { monthlyPrice: 3990, annualPrice: 38300 },
  })
})

afterEach(async () => {
  await app.close()
})

function post(url: string, payload?: object, as: User = user) {
  return app.inject({ method: 'POST', url, payload, headers: authHeader(app, as.id) })
}

/** The user pays Premium monthly, as Stripe and the API both have it. */
async function subscribe() {
  const metadata = { userId: user.id, planId: premium.id, period: 'MONTHLY' }
  billing.subscriptions.set('sub_1', stripeSubscription({ metadata }))
  return db.subscription.create({
    data: {
      userId: user.id,
      planId: premium.id,
      period: 'MONTHLY',
      status: 'active',
      stripeSubscriptionId: 'sub_1',
    },
  })
}

const subscription = () => db.subscription.findFirstOrThrow({ where: { userId: user.id } })

describe('renewal', () => {
  it('cancels the renewal: the plan stays until the end of the period, then resumes', async () => {
    await subscribe()

    const cancel = await post('/billing/subscription/renewal', { renew: false })

    expect(cancel.statusCode).toBe(204)
    expect(await subscription()).toMatchObject({ cancelAtPeriodEnd: true, status: 'active' })

    await post('/billing/subscription/renewal', { renew: true })
    expect((await subscription()).cancelAtPeriodEnd).toBe(false)
  })

  it('answers 404 NO_SUBSCRIPTION without a paid plan', async () => {
    const response = await post('/billing/subscription/renewal', { renew: false })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'NO_SUBSCRIPTION' })
  })
})

describe('billing period', () => {
  it('moves the subscription to another period at its price', async () => {
    await subscribe()

    const response = await post('/billing/subscription/period', { period: 'ANNUAL' })

    expect(response.statusCode).toBe(204)
    expect(billing.periodChanges).toEqual([{ id: 'sub_1', amount: 38300, period: 'ANNUAL' }])
    expect((await subscription()).period).toBe('ANNUAL')
  })

  it.each([
    ['the period it already has', 'MONTHLY', 'SAME_PERIOD'],
    ['a period without a price', 'SEMIANNUAL', 'PERIOD_NOT_OFFERED'],
  ])('answers 400 for %s', async (_case, period, code) => {
    await subscribe()

    const response = await post('/billing/subscription/period', { period })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code })
    expect(billing.periodChanges).toEqual([])
  })
})

describe('portal', () => {
  it("opens Stripe's portal for the customer, coming back to the plan page", async () => {
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: 'cus_9' } })

    const response = await post('/billing/portal')

    expect(response.json()).toEqual({
      url: `https://billing.stripe.com/p/session/test_cus_9?return=${encodeURIComponent('https://app.hostly.test/plano')}`,
    })
  })

  it('answers 404 NO_CUSTOMER for an account that never paid', async () => {
    expect((await post('/billing/portal')).json()).toMatchObject({ code: 'NO_CUSTOMER' })
  })
})

describe('GET /billing/payments', () => {
  it("lists the account's charges, newest first, with the plan and period", async () => {
    const sub = await subscribe()
    const other = await createUser(db)
    await db.billingPayment.createMany({
      data: [
        {
          userId: user.id,
          subscriptionId: sub.id,
          stripeInvoiceId: 'in_1',
          amount: 3990,
          status: 'paid',
          at: new Date('2026-10-14T12:00:00.000Z'),
        },
        {
          userId: user.id,
          subscriptionId: sub.id,
          stripeInvoiceId: 'in_2',
          amount: 3990,
          status: 'failed',
          at: new Date('2026-11-14T12:00:00.000Z'),
        },
        { userId: other.id, stripeInvoiceId: 'in_3', amount: 100, status: 'paid', at: new Date() },
      ],
    })

    const response = await app.inject({
      method: 'GET',
      url: '/billing/payments',
      headers: authHeader(app, user.id),
    })

    expect(response.json()).toEqual([
      {
        id: expect.any(String) as string,
        amount: 3990,
        status: 'failed',
        at: '2026-11-14T12:00:00.000Z',
        plan: 'Premium',
        period: 'MONTHLY',
      },
      expect.objectContaining({ status: 'paid', at: '2026-10-14T12:00:00.000Z' }),
    ])
  })

  it('answers 401 without a token', async () => {
    expect((await app.inject({ method: 'GET', url: '/billing/payments' })).statusCode).toBe(401)
  })
})
