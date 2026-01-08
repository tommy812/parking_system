INSERT INTO users (email, password_hash, role, phone)
VALUES ('demo@example.com', 'dev-placeholder', 'USER', '+447700900123')
ON CONFLICT (email) DO NOTHING