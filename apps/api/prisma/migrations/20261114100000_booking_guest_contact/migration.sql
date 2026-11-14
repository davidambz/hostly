-- The guest's phone and free notes on a booking, both optional.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "guest_phone" VARCHAR(11),
ADD COLUMN "notes" VARCHAR(2000);

-- Digits only: DDD + 9 (mobile) or DDD + 8 (landline), like the brokers' phones.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_guest_phone_format_check"
  CHECK ("guest_phone" IS NULL OR "guest_phone" ~ '^[0-9]{10,11}$');
