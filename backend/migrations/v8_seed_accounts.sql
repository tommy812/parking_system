-- Seed demo accounts
-- Emails: user@ex.com / owner@ex.com / admin@ex.com
-- Password (all): pass123
-- NOTE: bcrypt hash below MUST match "pass123".
-- Generate with Node:
--   node -e "console.log(require('bcryptjs').hashSync('pass123', 10))"

INSERT INTO users (email, password_hash, role, is_approved)
VALUES
  ('user@ex.com',  '<PASTE_BCRYPT_HASH_HERE>', 'USER',  true),
  ('owner@ex.com', '<PASTE_BCRYPT_HASH_HERE>', 'OWNER', true),
  ('admin@ex.com', '<PASTE_BCRYPT_HASH_HERE>', 'ADMIN', true)
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role,
    is_approved = EXCLUDED.is_approved;