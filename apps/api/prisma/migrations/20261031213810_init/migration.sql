-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('HOUSE', 'APARTMENT');

-- CreateEnum
CREATE TYPE "broker_type" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "phone" VARCHAR(11) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "property_type" NOT NULL,
    "zip_code" CHAR(8),
    "state" CHAR(2),
    "city" VARCHAR(255),
    "neighborhood" VARCHAR(255),
    "street" VARCHAR(255),
    "number" VARCHAR(20),
    "complement" VARCHAR(255),
    "building" VARCHAR(255),
    "block" VARCHAR(50),
    "unit" VARCHAR(20),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brokers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "broker_type" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "document" VARCHAR(14),
    "mobile_phone" VARCHAR(11),
    "landline_phone" VARCHAR(10),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "broker_id" UUID,
    "guest_name" VARCHAR(255) NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "nightly_rate" INTEGER NOT NULL,
    "cleaning_fee" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "broker_commission_bps" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- CreateIndex
CREATE INDEX "properties_user_id_name_idx" ON "properties"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "properties_id_user_id_key" ON "properties"("id", "user_id");

-- CreateIndex
CREATE INDEX "brokers_user_id_name_idx" ON "brokers"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "brokers_id_user_id_key" ON "brokers"("id", "user_id");

-- CreateIndex
CREATE INDEX "bookings_user_id_check_out_idx" ON "bookings"("user_id", "check_out");

-- CreateIndex
CREATE INDEX "bookings_property_id_check_in_idx" ON "bookings"("property_id", "check_in");

-- CreateIndex
CREATE INDEX "bookings_broker_id_idx" ON "bookings"("broker_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_user_id_fkey" FOREIGN KEY ("property_id", "user_id") REFERENCES "properties"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_broker_id_user_id_fkey" FOREIGN KEY ("broker_id", "user_id") REFERENCES "brokers"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Integrity checks (Prisma doesn't model CHECK constraints, so they live here).
-- The API validates all of this too; the database is the last line of defense.

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "users_cpf_format_check" CHECK ("cpf" ~ '^[0-9]{11}$'),
  ADD CONSTRAINT "users_phone_format_check" CHECK ("phone" ~ '^[0-9]{10,11}$');

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_zip_code_format_check" CHECK ("zip_code" ~ '^[0-9]{8}$'),
  ADD CONSTRAINT "properties_state_format_check" CHECK ("state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "properties_apartment_fields_check" CHECK (
    "type" = 'APARTMENT' OR ("building" IS NULL AND "block" IS NULL AND "unit" IS NULL)
  );

ALTER TABLE "brokers"
  ADD CONSTRAINT "brokers_document_format_check" CHECK (
    "document" IS NULL
    OR ("type" = 'INDIVIDUAL' AND "document" ~ '^[0-9]{11}$')
    OR ("type" = 'COMPANY' AND "document" ~ '^[0-9]{14}$')
  ),
  ADD CONSTRAINT "brokers_email_lowercase_check" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "brokers_mobile_phone_format_check" CHECK ("mobile_phone" ~ '^[0-9]{11}$'),
  ADD CONSTRAINT "brokers_landline_phone_format_check" CHECK ("landline_phone" ~ '^[0-9]{10}$');

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_dates_check" CHECK ("check_out" > "check_in"),
  ADD CONSTRAINT "bookings_amounts_check" CHECK (
    "nightly_rate" >= 0 AND "cleaning_fee" >= 0 AND "discount" >= 0 AND "amount_paid" >= 0
  ),
  ADD CONSTRAINT "bookings_broker_commission_check" CHECK (
    "broker_commission_bps" BETWEEN 0 AND 10000
    AND ("broker_id" IS NOT NULL OR "broker_commission_bps" = 0)
  );
