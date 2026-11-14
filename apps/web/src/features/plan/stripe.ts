import { loadStripe, type Stripe } from '@stripe/stripe-js'

/** Stripe.js loaded once per key, the first time a card form opens. */
const loaded = new Map<string, Promise<Stripe | null>>()

export function stripeFor(key: string): Promise<Stripe | null> {
  let stripe = loaded.get(key)
  if (!stripe) {
    stripe = loadStripe(key)
    loaded.set(key, stripe)
  }
  return stripe
}
