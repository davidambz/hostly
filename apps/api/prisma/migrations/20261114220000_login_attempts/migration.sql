-- Login attempts per e-mail (known or not) in the current window, against guessing one
-- account's password from many IP addresses.
CREATE TABLE "login_attempts" (
    "email" VARCHAR(254) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("email")
);

CREATE INDEX "login_attempts_window_started_at_idx" ON "login_attempts"("window_started_at");

ALTER TABLE "login_attempts"
  ADD CONSTRAINT "login_attempts_attempts_check" CHECK ("attempts" >= 1);
