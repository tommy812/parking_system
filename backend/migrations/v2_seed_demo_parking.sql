INSERT INTO parkings (name, address, timezone, capacity, currency, image_url)
VALUES (
  'City Centre Parking',
  '123 High Street, Southampton',
  'Europe/London',
  20,
  'GBP',
  NULL
);

-- pricing tiers: 1h £2, 4h £3, 8h £5
INSERT INTO pricing_tiers (parking_id, max_minutes, price_pence, currency, is_active)
SELECT p.id, t.max_minutes, t.price_pence, 'GBP', true
FROM parkings p
CROSS JOIN (VALUES
  (60, 200),
  (240, 300),
  (480, 500)
) AS t(max_minutes, price_pence)
WHERE p.name = 'City Centre Parking';
