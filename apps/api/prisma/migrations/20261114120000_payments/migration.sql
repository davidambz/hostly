-- Payments: what a guest paid, entry by entry, each with its day. A booking's amount_paid
-- stays as a column (lists and the calendar read it without a join) and is kept equal to
-- the sum of its payments by the API, in the same transaction as every payment change.

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "note" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_booking_id_paid_on_idx" ON "payments"("booking_id", "paid_on");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_id_user_id_key" ON "bookings"("id", "user_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_user_id_fkey" FOREIGN KEY ("booking_id", "user_id") REFERENCES "bookings"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A payment is money received: more than zero, within the API's cap.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amount" BETWEEN 1 AND 1000000000);

-- What bookings already had as paid becomes their first payment, on the day they were made.
INSERT INTO "payments" ("id", "user_id", "booking_id", "amount", "paid_on", "note")
SELECT gen_random_uuid(), "user_id", "id", "amount_paid", "created_at"::date, 'Pago antes dos lançamentos'
FROM "bookings"
WHERE "amount_paid" > 0;
