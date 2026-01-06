-- Owner approval flow:
-- - owners can register but are not approved until an admin approves
-- - parkings created during owner registration are inactive until approved

-- =========
-- Users: is_approved
-- =========
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true;

-- Existing OWNER users should be approved by default (backwards compat)
UPDATE users
SET is_approved = true
WHERE role IN ('OWNER', 'ADMIN') AND is_approved IS DISTINCT FROM true;

-- =========
-- Parkings: is_active
-- =========
ALTER TABLE parkings
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- =========
-- Owner registration requests
-- =========
DO $$ BEGIN
  CREATE TYPE owner_registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS owner_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  parking_id UUID NOT NULL REFERENCES parkings(id) ON DELETE CASCADE,
  status owner_registration_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_owner_registrations_status ON owner_registrations(status);

