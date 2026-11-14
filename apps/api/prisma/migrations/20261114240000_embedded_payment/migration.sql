-- Paying moves from Stripe Checkout to a card form inside the app: no checkout session to
-- keep, and each plan gets its product at Stripe, created on the first subscription.
ALTER TABLE "users" DROP COLUMN "stripe_checkout_session_id";

ALTER TABLE "plans" ADD COLUMN "stripe_product_id" VARCHAR(255);
CREATE UNIQUE INDEX "plans_stripe_product_id_key" ON "plans"("stripe_product_id");
