-- Defaults a new booking starts with: the nightly rate and cleaning fee of a property, the
-- commission of a broker. All optional; the booking keeps its own values once saved.

-- AlterTable
ALTER TABLE "properties" ADD COLUMN "default_cleaning_fee" INTEGER,
ADD COLUMN "default_nightly_rate" INTEGER;

-- AlterTable
ALTER TABLE "brokers" ADD COLUMN "default_commission_bps" INTEGER;

-- Same bounds as the booking's own amounts and commission.
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_default_nightly_rate_check"
  CHECK ("default_nightly_rate" IS NULL OR "default_nightly_rate" BETWEEN 0 AND 1000000000),
  ADD CONSTRAINT "properties_default_cleaning_fee_check"
  CHECK ("default_cleaning_fee" IS NULL OR "default_cleaning_fee" BETWEEN 0 AND 1000000000);

ALTER TABLE "brokers"
  ADD CONSTRAINT "brokers_default_commission_bps_check"
  CHECK ("default_commission_bps" IS NULL OR "default_commission_bps" BETWEEN 0 AND 10000);
