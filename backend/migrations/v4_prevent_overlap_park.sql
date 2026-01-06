-- Needed for GiST exclusion constraints on UUID equality
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent same user booking same parking in overlapping time ranges
-- Only applies to bookings that reserve capacity (PENDING/CONFIRMED)
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap_user_parking
EXCLUDE USING gist (
  user_id WITH =,
  parking_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (status IN ('PENDING', 'CONFIRMED'));
