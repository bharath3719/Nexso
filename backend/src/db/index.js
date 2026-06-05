import { Pool } from "pg";
import { log } from "../utils/logger.js";

let pool = null;
let connected = false;

export function getDb() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Fallback to local credentials if DATABASE_URL is not set
    const host = process.env.PGHOST || "127.0.0.1";
    const port = Number(process.env.PGPORT || 5432);
    const user = process.env.PGUSER || "postgres";
    const password = process.env.PGPASSWORD || "postgres";
    const database = process.env.PGDATABASE || "nexso";
    log("DATABASE_URL not set. Using local PG config:", { host, port, user, database });
    pool = new Pool({ host, port, user, password, database });
  } else {
    pool = new Pool({ connectionString: url });
  }
  pool.on("error", (err) => {
    log("Postgres client error:", err);
  });
  return pool;
}

export async function ensureSchema() {
  const db = getDb();
  if (!db) return false;
  try {
    await db.query("BEGIN");

    await db.query(`CREATE TABLE IF NOT EXISTS societies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS code TEXT`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_societies_code_unique ON societies (LOWER(code))`);

    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      whatsapp_number TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL,
      society_id INTEGER REFERENCES societies(id) ON DELETE SET NULL,
      apartment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS apartment TEXT`);

    await db.query(`CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      whatsapp_number TEXT UNIQUE,
      categories TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT UNIQUE,
      society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      raised_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      description TEXT,
      media_urls TEXT[],
      priority TEXT DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'OPEN',
      assigned_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS ticket_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL,
      sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sender_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
      message_type TEXT NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS ticket_activity_logs (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      actor_role TEXT NOT NULL,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id SERIAL PRIMARY KEY,
      message_id TEXT UNIQUE,
      sender_whatsapp_number TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      message_type TEXT NOT NULL,
      raw_message_payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS whatsapp_outbound_messages (
      id                SERIAL PRIMARY KEY,
      message_id        TEXT UNIQUE,
      recipient         TEXT NOT NULL,
      message_type      TEXT NOT NULL,
      payload           JSONB NOT NULL,
      status            TEXT NOT NULL DEFAULT 'sent',
      status_updated_at TIMESTAMPTZ,
      sent_at           TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id SERIAL PRIMARY KEY,
      whatsapp_number TEXT UNIQUE NOT NULL,
      state TEXT NOT NULL DEFAULT 'awaiting_society',
      context JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // ── Building Onboarding — extend societies ───────────────────────────────
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS address TEXT`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS num_towers INTEGER DEFAULT 1`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS num_floors INTEGER DEFAULT 1`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS num_units INTEGER DEFAULT 0`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS contact_person TEXT`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS contact_phone TEXT`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS contact_email TEXT`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS society_type TEXT DEFAULT 'APARTMENT'`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS building_id TEXT`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1`);

    // ── Towers ───────────────────────────────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS towers (
      id SERIAL PRIMARY KEY,
      society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      num_floors INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // ── Floors ───────────────────────────────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS floors (
      id SERIAL PRIMARY KEY,
      tower_id INTEGER REFERENCES towers(id) ON DELETE CASCADE,
      society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      floor_number INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // ── Units ────────────────────────────────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE,
      tower_id INTEGER REFERENCES towers(id) ON DELETE CASCADE,
      society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      unit_number TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // ── Residents ────────────────────────────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS residents (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
      society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      aadhar_number TEXT,
      preferred_contact TEXT DEFAULT 'WHATSAPP',
      bhk TEXT,
      resident_type TEXT DEFAULT 'OWNER',
      family_members INTEGER DEFAULT 0,
      invitation_status TEXT DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Add new resident columns if table already existed
    await db.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS aadhar_number TEXT`);
    await db.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT 'WHATSAPP'`);
    await db.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS bhk TEXT`);
    await db.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);

    // ── Auth accounts (web-portal login) ─────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS auth_accounts (
      id                   SERIAL PRIMARY KEY,
      username             TEXT UNIQUE NOT NULL,
      password_hash        TEXT NOT NULL,
      portal_role          TEXT NOT NULL DEFAULT 'SOCIETY_ADMIN',
      society_id           INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      vendor_id            INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
      force_password_reset BOOLEAN DEFAULT TRUE,
      last_login           TIMESTAMPTZ,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    )`);

    await db.query(`ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_accounts_username ON auth_accounts (LOWER(username))`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_accounts_society  ON auth_accounts (society_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_accounts_vendor   ON auth_accounts (vendor_id)`);

    // Ensure portal_role CHECK includes VENDOR — drop and re-create idempotently
    await db.query(`
      DO $$
      BEGIN
        ALTER TABLE auth_accounts DROP CONSTRAINT IF EXISTS auth_accounts_portal_role_check;
        ALTER TABLE auth_accounts
          ADD CONSTRAINT auth_accounts_portal_role_check
          CHECK (portal_role IN ('NEXSO_ADMIN','SOCIETY_ADMIN','VENDOR'));
      END$$;
    `);

    // ── Vendors — verification columns (added after initial create) ───────────
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_name TEXT`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS owner_name TEXT`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone TEXT`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gst TEXT`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS team_size INTEGER`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS emergency_availability BOOLEAN DEFAULT FALSE`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'VERIFICATION_PENDING'`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await db.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'vendors_verification_status_check'
        ) THEN
          ALTER TABLE vendors
            ADD CONSTRAINT vendors_verification_status_check
            CHECK (verification_status IN ('VERIFICATION_PENDING','APPROVED','REJECTED','SUSPENDED'));
        END IF;
      EXCEPTION WHEN duplicate_object THEN
        -- ignore
      END$$;
    `);

    // ── Societies — maintenance feature columns ───────────────────────────────
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS maintenance_enabled BOOLEAN DEFAULT FALSE`);
    await db.query(`ALTER TABLE societies ADD COLUMN IF NOT EXISTS maintenance_upi_id TEXT`);

    // ── Maintenance settings (per-unit recurring amount + day) ───────────────
    await db.query(`CREATE TABLE IF NOT EXISTS maintenance_settings (
      id         SERIAL PRIMARY KEY,
      unit_id    INTEGER UNIQUE REFERENCES units(id) ON DELETE CASCADE,
      society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      enabled    BOOLEAN DEFAULT FALSE,
      amount     NUMERIC,
      due_day    INTEGER,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    // Migrate existing DBs: add unit_id if the table was created with resident_id
    await db.query(`ALTER TABLE maintenance_settings ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE`);
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_settings_unit_id_key'
        ) THEN
          ALTER TABLE maintenance_settings ADD CONSTRAINT maintenance_settings_unit_id_key UNIQUE (unit_id);
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── Maintenance dues (one row per resident per month) ─────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS maintenance_dues (
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
    )`);

    // ── Expense sheet for itemised billing ───────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS maintenance_expense_sheets (
      id             SERIAL PRIMARY KEY,
      society_id     INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      month          VARCHAR(7) NOT NULL,
      fixed_items    JSONB NOT NULL DEFAULT '[]',
      variable_items JSONB NOT NULL DEFAULT '[]',
      interest_rate  NUMERIC(5,2) DEFAULT 21.00,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(society_id, month)
    )`);

    // Extra columns on maintenance_dues for itemised billing
    await db.query(`ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS breakdown           JSONB`);
    await db.query(`ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS base_amount         NUMERIC(10,2)`);
    await db.query(`ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS expense_share       NUMERIC(10,2)`);
    await db.query(`ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS previously_due      NUMERIC(10,2) DEFAULT 0`);
    await db.query(`ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS interest_amount     NUMERIC(10,2) DEFAULT 0`);
    await db.query(`ALTER TABLE maintenance_dues ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ`);

    // Ticket: unit reference + escalation tracking
    await db.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS unit_id      INTEGER REFERENCES units(id) ON DELETE SET NULL`);
    await db.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ`);

    // One OWNER and one TENANT per unit
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_unit_owner  ON residents(unit_id) WHERE resident_type = 'OWNER'  AND unit_id IS NOT NULL`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_unit_tenant ON residents(unit_id) WHERE resident_type = 'TENANT' AND unit_id IS NOT NULL`);

    await db.query("COMMIT");
    connected = true;
    log("Database schema ensured.");
    return true;
  } catch (err) {
    await db.query("ROLLBACK");
    log("Failed to ensure schema:", err);
    return false;
  }
}

export async function dbQuery(sql, params) {
  const db = getDb();
  if (!db) return null;
  return db.query(sql, params);
}

export function isDbConnected() {
  return connected && !!pool;
}
