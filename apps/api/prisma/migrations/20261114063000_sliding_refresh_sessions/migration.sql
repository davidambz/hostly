-- Sessions slide: every refresh pushes a token's expiry forward (REFRESH_TOKEN_TTL_DAYS from
-- then), up to a hard end fixed at login (REFRESH_SESSION_MAX_DAYS), shared by the family.
-- Existing tokens keep the expiry they had as their session's end, so nothing gets longer.

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "session_expires_at" TIMESTAMPTZ(3);
UPDATE "refresh_tokens" SET "session_expires_at" = "expires_at";
ALTER TABLE "refresh_tokens" ALTER COLUMN "session_expires_at" SET NOT NULL;

-- A token never outlives its session.
ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_expiry_within_session_check"
  CHECK ("expires_at" <= "session_expires_at");
