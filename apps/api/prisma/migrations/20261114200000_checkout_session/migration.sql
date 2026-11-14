-- The Stripe Checkout the user last opened: a new one expires it, so two tabs can't pay twice.
ALTER TABLE "users" ADD COLUMN "stripe_checkout_session_id" VARCHAR(255);
