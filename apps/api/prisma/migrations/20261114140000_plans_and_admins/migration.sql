-- Plans and administrators: the base of the subscription module. Free allows one property;
-- Premium, unlimited. Prices stay empty until they are set in the backoffice.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "max_properties" INTEGER,
    "monthly_price" INTEGER,
    "semiannual_price" INTEGER,
    "annual_price" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- A plan allows at least one property (null: unlimited); prices are cents within the cap.
ALTER TABLE "plans"
  ADD CONSTRAINT "plans_max_properties_check"
  CHECK ("max_properties" IS NULL OR "max_properties" >= 1),
  ADD CONSTRAINT "plans_prices_check"
  CHECK (
    ("monthly_price" IS NULL OR "monthly_price" BETWEEN 0 AND 1000000000) AND
    ("semiannual_price" IS NULL OR "semiannual_price" BETWEEN 0 AND 1000000000) AND
    ("annual_price" IS NULL OR "annual_price" BETWEEN 0 AND 1000000000)
  );

-- Free is free forever and always on: it is what every account falls back to.
ALTER TABLE "plans"
  ADD CONSTRAINT "plans_free_check"
  CHECK ("code" IS DISTINCT FROM 'free' OR (
    "active" AND "monthly_price" IS NULL AND "semiannual_price" IS NULL AND "annual_price" IS NULL
  ));

INSERT INTO "plans" ("id", "code", "name", "description", "max_properties", "updated_at") VALUES
  (gen_random_uuid(), 'free', 'Free', 'Para começar: um imóvel, de graça, sem prazo.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'premium', 'Premium', 'Imóveis ilimitados e tudo o que o Hostly tem.', NULL, CURRENT_TIMESTAMP);
