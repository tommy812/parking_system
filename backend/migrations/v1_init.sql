-- =========
-- Extensions
-- =========
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========
-- Enums
-- =========
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('REQUIRES_PAYMENT', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========
-- Users
-- =========
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========
-- Parkings
-- =========
CREATE TABLE IF NOT EXISTS parkings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  capacity INT NOT NULL CHECK (capacity > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================
-- Pricing tiers
-- =================
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id UUID NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  max_minutes INT NOT NULL CHECK (max_minutes > 0),
  price_pence INT NOT NULL CHECK (price_pence >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parking_id, max_minutes)
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_parking ON pricing_tiers (parking_id);

-- =========
-- Bookings
-- =========
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parking_id UUID NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'PENDING',
  total_amount_pence INT NOT NULL DEFAULT 0 CHECK (total_amount_pence >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

-- helpful indexes for availability checks
CREATE INDEX IF NOT EXISTS idx_bookings_parking_time ON bookings (parking_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- =========
-- Payments
-- =========
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_payment_id TEXT,
  status payment_status NOT NULL DEFAULT 'REQUIRES_PAYMENT',
  amount_pence INT NOT NULL CHECK (amount_pence >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id);
