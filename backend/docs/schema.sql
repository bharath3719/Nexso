-- Full schema for Nexso backend
-- Run via: npm run db:schema
-- Also auto-applied on startup via ensureSchema() in db/index.js

CREATE TABLE IF NOT EXISTS societies (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  code                TEXT,
  address             TEXT,
  num_towers          INTEGER DEFAULT 1,
  num_floors          INTEGER DEFAULT 1,
  num_units           INTEGER DEFAULT 0,
  contact_person      TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,
  society_type        TEXT DEFAULT 'APARTMENT',
  building_id         TEXT,
  onboarding_step     INTEGER DEFAULT 1,
  maintenance_enabled BOOLEAN DEFAULT FALSE,
  maintenance_upi_id  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,
  name            TEXT,
  role            TEXT NOT NULL CHECK (role IN ('OWNER','SOCIETY_ADMIN','VENDOR')),
  society_id      INTEGER REFERENCES societies(id) ON DELETE SET NULL,
  apartment       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT NOT NULL,
  code                   TEXT,
  whatsapp_number        TEXT UNIQUE,
  categories             TEXT[] NOT NULL DEFAULT '{}',
  active                 BOOLEAN DEFAULT TRUE,
  business_name          TEXT,
  owner_name             TEXT,
  phone                  TEXT,
  email                  TEXT,
  gst                    TEXT,
  team_size              INTEGER,
  emergency_availability BOOLEAN DEFAULT FALSE,
  verification_status    TEXT DEFAULT 'VERIFICATION_PENDING'
                           CHECK (verification_status IN ('VERIFICATION_PENDING','APPROVED','REJECTED','SUSPENDED')),
  verified_at            TIMESTAMPTZ,
  verified_by            INTEGER,
  rejection_reason       TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT UNIQUE,
  society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  raised_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT,
  media_urls TEXT[],
  priority TEXT DEFAULT 'NORMAL',
  status TEXT NOT NULL CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_activity_logs (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE,
  sender_whatsapp_number TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  message_type TEXT NOT NULL,
  raw_message_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_societies_code_unique ON societies (LOWER(code));

-- Vendor suspensions audit trail
CREATE TABLE IF NOT EXISTS vendor_suspensions (
  id          SERIAL PRIMARY KEY,
  vendor_id   INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  reason      TEXT,
  suspended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  suspended_at TIMESTAMPTZ DEFAULT NOW(),
  restored_at TIMESTAMPTZ
);

-- Vendor documents (admin-uploaded)
CREATE TABLE IF NOT EXISTS vendor_documents (
  id          SERIAL PRIMARY KEY,
  vendor_id   INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  doc_type    TEXT,
  filename    TEXT,
  url         TEXT,
  metadata    JSONB,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor service areas
CREATE TABLE IF NOT EXISTS vendor_service_areas (
  id          SERIAL PRIMARY KEY,
  vendor_id   INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  building_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  region      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Towers, floors, units, residents (society structure)
CREATE TABLE IF NOT EXISTS towers (
  id         SERIAL PRIMARY KEY,
  society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  num_floors INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS floors (
  id           SERIAL PRIMARY KEY,
  tower_id     INTEGER REFERENCES towers(id) ON DELETE CASCADE,
  society_id   INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id          SERIAL PRIMARY KEY,
  floor_id    INTEGER REFERENCES floors(id) ON DELETE CASCADE,
  tower_id    INTEGER REFERENCES towers(id) ON DELETE CASCADE,
  society_id  INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS residents (
  id                 SERIAL PRIMARY KEY,
  unit_id            INTEGER REFERENCES units(id) ON DELETE CASCADE,
  society_id         INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  aadhar_number      TEXT,
  preferred_contact  TEXT DEFAULT 'WHATSAPP',
  bhk                TEXT,
  resident_type      TEXT DEFAULT 'OWNER',
  family_members     INTEGER DEFAULT 0,
  invitation_status  TEXT DEFAULT 'PENDING',
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound WhatsApp messages sent by the system
CREATE TABLE IF NOT EXISTS whatsapp_outbound_messages (
  id                SERIAL PRIMARY KEY,
  message_id        TEXT UNIQUE,
  recipient         TEXT NOT NULL,
  message_type      TEXT NOT NULL,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'sent',
  status_updated_at TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp session state for multi-turn registration flow
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id               SERIAL PRIMARY KEY,
  whatsapp_number  TEXT UNIQUE NOT NULL,
  state            TEXT NOT NULL DEFAULT 'awaiting_society',
  context          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Web-portal auth accounts (society secretaries, vendors, nexso admins)
CREATE TABLE IF NOT EXISTS auth_accounts (
  id                   SERIAL PRIMARY KEY,
  username             TEXT UNIQUE NOT NULL,
  password_hash        TEXT NOT NULL,
  portal_role          TEXT NOT NULL DEFAULT 'SOCIETY_ADMIN'
                         CHECK (portal_role IN ('NEXSO_ADMIN','SOCIETY_ADMIN','VENDOR')),
  society_id           INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  vendor_id            INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  force_password_reset BOOLEAN DEFAULT TRUE,
  last_login           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_username ON auth_accounts (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_auth_accounts_society  ON auth_accounts (society_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_vendor   ON auth_accounts (vendor_id);

-- Maintenance settings per unit (recurring amount + due day)
CREATE TABLE IF NOT EXISTS maintenance_settings (
  id         SERIAL PRIMARY KEY,
  unit_id    INTEGER UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  enabled    BOOLEAN DEFAULT FALSE,
  amount     NUMERIC,
  due_day    INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance dues — one row per resident per month
CREATE TABLE IF NOT EXISTS maintenance_dues (
  id                       SERIAL PRIMARY KEY,
  resident_id              INTEGER REFERENCES residents(id) ON DELETE CASCADE,
  society_id               INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  amount                   NUMERIC NOT NULL,
  due_month                TEXT NOT NULL,
  due_date                 DATE,
  status                   TEXT NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','PAID','OVERDUE','WAIVED')),
  payment_reference        TEXT,
  payment_date             TIMESTAMPTZ,
  notes                    TEXT,
  razorpay_payment_link_id TEXT,
  razorpay_payment_id      TEXT,
  payment_link             TEXT,
  reminder_sent_at         TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (resident_id, due_month)
);

-- Extra columns on maintenance_dues for itemised billing
ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS breakdown       JSONB;
ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS base_amount     NUMERIC(10,2);
ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS expense_share   NUMERIC(10,2);
ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS previously_due  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(10,2) DEFAULT 0;

-- Ticket: unit reference + escalation tracking
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS unit_id      INTEGER REFERENCES units(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- One OWNER and one TENANT per unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_unit_owner
  ON residents(unit_id) WHERE resident_type = 'OWNER' AND unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_unit_tenant
  ON residents(unit_id) WHERE resident_type = 'TENANT' AND unit_id IS NOT NULL;

-- Monthly expense sheet entered by secretary (line-item bill builder)
CREATE TABLE IF NOT EXISTS maintenance_expense_sheets (
  id             SERIAL PRIMARY KEY,
  society_id     INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  month          VARCHAR(7) NOT NULL,
  fixed_items    JSONB NOT NULL DEFAULT '[]',
  variable_items JSONB NOT NULL DEFAULT '[]',
  interest_rate  NUMERIC(5,2) DEFAULT 21.00,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(society_id, month)
);
