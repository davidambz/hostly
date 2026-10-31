-- Sort names the way people expect ("apê" < "Casa" < "Sítio"), not by byte value, which
-- puts every uppercase letter before any lowercase one and accented letters last.
-- Prisma doesn't model column collations, so this lives only in SQL.
ALTER TABLE "properties" ALTER COLUMN "name" TYPE VARCHAR(255) COLLATE "und-x-icu";
ALTER TABLE "brokers" ALTER COLUMN "name" TYPE VARCHAR(255) COLLATE "und-x-icu";
