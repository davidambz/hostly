-- Plans an administrator gives a user, free of charge (1 month, 6 months, 1 year or for
-- life), and the history of what was done to each grant, by whom and why.

-- CreateEnum
CREATE TYPE "GrantDuration" AS ENUM ('ONE_MONTH', 'SIX_MONTHS', 'ONE_YEAR', 'LIFETIME');

-- CreateEnum
CREATE TYPE "GrantAction" AS ENUM ('GRANTED', 'RENEWED', 'PLAN_CHANGED', 'REVOKED');

-- CreateTable
CREATE TABLE "plan_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "granted_by_id" UUID,
    "duration" "GrantDuration" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(500) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_grant_events" (
    "id" UUID NOT NULL,
    "grant_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "GrantAction" NOT NULL,
    "plan_id" UUID NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "duration" "GrantDuration",
    "reason" VARCHAR(500) NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_grant_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_grants_user_id_revoked_at_idx" ON "plan_grants"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "plan_grant_events_grant_id_at_idx" ON "plan_grant_events"("grant_id", "at");

-- AddForeignKey
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_grant_events" ADD CONSTRAINT "plan_grant_events_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "plan_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_grant_events" ADD CONSTRAINT "plan_grant_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_grant_events" ADD CONSTRAINT "plan_grant_events_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A lifetime grant has no end; any other ends after it starts.
ALTER TABLE "plan_grants"
  ADD CONSTRAINT "plan_grants_ends_check"
  CHECK (
    ("duration" = 'LIFETIME' AND "ends_at" IS NULL) OR
    ("duration" <> 'LIFETIME' AND "ends_at" > "starts_at")
  );

-- At most one grant in force per user at any moment: revoked ones don't count.
ALTER TABLE "plan_grants"
  ADD CONSTRAINT "plan_grants_no_overlap"
  EXCLUDE USING gist (
    "user_id" WITH =,
    tstzrange("starts_at", COALESCE("ends_at", 'infinity'::timestamptz)) WITH &&
  ) WHERE ("revoked_at" IS NULL);
