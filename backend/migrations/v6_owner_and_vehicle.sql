-- Add parking ownership + user vehicle metadata

-- =========
-- Parkings: owner_user_id
-- =========
ALTER TABLE parkings
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parkings_owner_user_id ON parkings (owner_user_id);

-- =========
-- Users: vehicle fields
-- =========
ALTER TABLE users
ADD COLUMN IF NOT EXISTS vehicle_reg TEXT,
ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
ADD COLUMN IF NOT EXISTS vehicle_year INT;

-- Basic sanity checks (non-breaking: allow NULLs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_vehicle_year_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_vehicle_year_check;
  END IF;
END $$;

ALTER TABLE users
ADD CONSTRAINT users_vehicle_year_check
CHECK (
  vehicle_year IS NULL OR (vehicle_year >= 1900 AND vehicle_year <= 2100)
);

