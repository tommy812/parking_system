-- Parking search + schedule rules

-- =========
-- Geo (simple lat/lng without PostGIS)
-- =========
ALTER TABLE parkings
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- =========
-- Schedule rules (UTC-based for simplicity)
-- =========
ALTER TABLE parkings
ADD COLUMN IF NOT EXISTS open_start_minute_utc INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS open_end_minute_utc INT NOT NULL DEFAULT 1440,
ADD COLUMN IF NOT EXISTS min_booking_minutes INT NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS max_booking_minutes INT NOT NULL DEFAULT 1440,
ADD COLUMN IF NOT EXISTS buffer_minutes INT NOT NULL DEFAULT 0;

-- sanity checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parkings_schedule_check') THEN
    ALTER TABLE parkings DROP CONSTRAINT parkings_schedule_check;
  END IF;
END $$;

ALTER TABLE parkings
ADD CONSTRAINT parkings_schedule_check CHECK (
  open_start_minute_utc >= 0 AND open_start_minute_utc <= 1440 AND
  open_end_minute_utc >= 0 AND open_end_minute_utc <= 1440 AND
  open_end_minute_utc > open_start_minute_utc AND
  min_booking_minutes > 0 AND
  max_booking_minutes >= min_booking_minutes AND
  buffer_minutes >= 0
);

-- =========
-- Blackout ranges
-- =========
CREATE TABLE IF NOT EXISTS parking_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id UUID NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_parking_blackouts_parking_time
  ON parking_blackouts(parking_id, start_at, end_at);

