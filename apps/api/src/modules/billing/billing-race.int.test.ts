import { setTimeout as sleep } from 'node:timers/promises'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

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

// Events whose id starts with `evt_slow` hold their transaction open for a moment, so a
// second delivery can arrive while the first is still being applied.
beforeAll(async () => {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION test_slow_stripe_event() RETURNS trigger AS $$
    BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END $$ LANGUAGE plpgsql`)
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE TRIGGER test_slow_stripe_event AFTER INSERT ON stripe_events
    FOR EACH ROW WHEN (NEW.id LIKE 'evt_slow%') EXECUTE FUNCTION test_slow_stripe_event()`)
})

afterAll(async () => {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_slow_stripe_event ON stripe_events')
  await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_slow_stripe_event')
})

beforeEach(async () => {
  billing = new FakeBilling()
  app = await buildApp(testEnv({ APP_URL: 'https://app.hostly.test' }), { db, billing })
  user = await createUser(db)
  premium = await db.plan.update({ where: { code: 'premium' }, data: { monthlyPrice: 3990 } })
})

afterEach(async () => {
  await app.close()
})

function webhook(payload: string) {
  return app.inject({
    method: 'POST',
    url: '/billing/webhook',
    payload,
    headers: { 'content-type': 'application/json', 'stripe-signature': billing.sign(payload) },
  })
}

function checkout() {
  return app.inject({
    method: 'POST',
    url: '/billing/checkout',
    payload: { planId: premium.id, period: 'MONTHLY' },
    headers: authHeader(app, user.id),
  })
}

const metadata = () => ({ userId: user.id, planId: premium.id, period: 'MONTHLY' })

const source = async () =>
  (await app.inject({ method: 'GET', url: '/me/plan', headers: authHeader(app, user.id) })).json<{
    source: string
  }>().source

const invoice = (id: string, paid: boolean) => ({
  id,
  customer: 'cus_x',
  amount_paid: paid ? 3990 : 0,
  amount_due: 3990,
  created: 1_800_000_000,
  parent: { subscription_details: { subscription: 'sub_1' } },
})

describe('webhooks out of order', () => {
  it('keeps a cancelled subscription cancelled when an older update arrives last', async () => {
    const active = stripeSubscription({ metadata: metadata() })
    await webhook(billing.subscriptionEvent('evt_1', 'customer.subscription.created', active))
    await webhook(
      billing.subscriptionEvent(
        'evt_3',
        'customer.subscription.deleted',
        stripeSubscription({ metadata: metadata(), status: 'canceled' }),
      ),
    )

    // Sent before the cancellation, delivered after it, still saying "active".
    const late = await webhook(stripeEvent('evt_2', 'customer.subscription.updated', active))

    expect(late.statusCode).toBe(200)
    expect(await source()).toBe('FREE')
    expect((await db.subscription.findFirstOrThrow()).status).toBe('canceled')
  })

  it('keeps a paid invoice paid when its failure arrives after it', async () => {
    await webhook(
      billing.subscriptionEvent(
        'evt_1',
        'customer.subscription.created',
        stripeSubscription({ metadata: metadata() }),
      ),
    )
    await webhook(stripeEvent('evt_3', 'invoice.paid', invoice('in_1', true)))

    await webhook(stripeEvent('evt_2', 'invoice.payment_failed', invoice('in_1', false)))

    expect(await source()).toBe('SUBSCRIPTION')
    expect(await db.billingPayment.findFirstOrThrow()).toMatchObject({
      status: 'paid',
      amount: 3990,
    })
  })
})

describe('the same event twice at once', () => {
  it('applies it once and answers both deliveries', async () => {
    const payload = billing.subscriptionEvent(
      'evt_slow_1',
      'customer.subscription.created',
      stripeSubscription({ metadata: metadata() }),
    )

    const first = webhook(payload)
    await sleep(100)
    const responses = await Promise.all([first, webhook(payload)])

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200])
    expect(await db.stripeEvent.count()).toBe(1)
    expect(await db.subscription.count()).toBe(1)
  })
})

describe('one checkout at a time', () => {
  it('creates one customer for two checkouts at once, and expires the first', async () => {
    const responses = await Promise.all([checkout(), checkout()])

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200])
    expect(billing.customers).toHaveLength(1)
    expect([...billing.checkoutStatus.values()]).toEqual(['expired', 'open'])
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).stripeCheckoutSessionId,
    ).toBe('cs_test_2')
  })

  it('answers 409 SUBSCRIPTION_EXISTS when the previous checkout was already paid', async () => {
    await checkout()
    billing.checkoutStatus.set('cs_test_1', 'complete')

    const response = await checkout()

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({ code: 'SUBSCRIPTION_EXISTS' })
    expect(billing.checkouts).toHaveLength(1)
  })

  it('forgets a paid checkout once Stripe confirms it, so a later one can start', async () => {
    await checkout()
    billing.checkoutStatus.set('cs_test_1', 'complete')
    billing.subscriptions.set(
      'sub_1',
      stripeSubscription({ metadata: metadata(), status: 'canceled' }),
    )

    await webhook(
      stripeEvent('evt_1', 'checkout.session.completed', {
        id: 'cs_test_1',
        subscription: 'sub_1',
      }),
    )

    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).stripeCheckoutSessionId,
    ).toBeNull()
    expect((await checkout()).statusCode).toBe(200)
  })
})
