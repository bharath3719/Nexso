-- Seed minimal demo data for Nexso
-- Requires tables from ensureSchema() (src/db/index.js) — run `npm run db:schema`

-- 1) Ensure a society exists and capture its id via name lookup
INSERT INTO societies (name)
SELECT 'Sunshine Residency'
WHERE NOT EXISTS (SELECT 1 FROM societies WHERE name = 'Sunshine Residency');

-- 2) Seed an OWNER user bound to the society
INSERT INTO users (whatsapp_number, role, society_id, name, apartment)
SELECT '+911234567890', 'OWNER', s.id, 'Rohan Mehta', 'A-101'
FROM societies s
WHERE s.name = 'Sunshine Residency'
ON CONFLICT (whatsapp_number) DO UPDATE
SET role = EXCLUDED.role,
	society_id = EXCLUDED.society_id,
	name = EXCLUDED.name,
	apartment = EXCLUDED.apartment;

-- 3) Seed a PLUMBING vendor bound to the society
INSERT INTO vendors (name, whatsapp_number, society_id, categories, active)
SELECT 'PlumbRight', '+919999999999', s.id, ARRAY['PLUMBING'], TRUE
FROM societies s
WHERE s.name = 'Sunshine Residency'
ON CONFLICT (whatsapp_number) DO NOTHING;
