-- Enforce valid user roles
-- Allowed roles: USER, ADMIN, OWNER

-- Normalize any unexpected values to USER (defensive, for existing data)
UPDATE users
SET role = 'USER'
WHERE role IS NULL
   OR role NOT IN ('USER', 'ADMIN', 'OWNER');

-- Ensure default is USER
ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'USER';

-- Add/replace a CHECK constraint to enforce allowed roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('USER', 'ADMIN', 'OWNER'));

