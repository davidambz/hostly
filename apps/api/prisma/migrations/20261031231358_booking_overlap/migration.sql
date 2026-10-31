-- No two bookings of the same property may share a night. Enforced by the database, so
-- two requests racing for the same dates can't both get in. Check-out day is free for
-- the next check-in: the range is [check_in, check_out).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("property_id" WITH =, daterange("check_in", "check_out", '[)') WITH &&);
