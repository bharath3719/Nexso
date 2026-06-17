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

    // Ensure portal_role CHECK includes VENDOR + RESIDENT — drop and re-create idempotently
    await db.query(`
      DO $$
      BEGIN
        ALTER TABLE auth_accounts DROP CONSTRAINT IF EXISTS auth_accounts_portal_role_check;
        ALTER TABLE auth_accounts
          ADD CONSTRAINT auth_accounts_portal_role_check
          CHECK (portal_role IN ('NEXSO_ADMIN','SOCIETY_ADMIN','VENDOR','RESIDENT'));
      END$$;
    `);
    await db.query(`ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS resident_id INTEGER REFERENCES residents(id) ON DELETE CASCADE`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_accounts_resident ON auth_accounts (resident_id)`);

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

    // One OWNER and one TENANT per unit (non-fatal — existing data may have duplicates)
    await db.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_unit_owner
          ON residents(unit_id) WHERE resident_type = 'OWNER' AND unit_id IS NOT NULL;
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    await db.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_unit_tenant
          ON residents(unit_id) WHERE resident_type = 'TENANT' AND unit_id IS NOT NULL;
      EXCEPTION WHEN others THEN NULL; END $$;
    `);

    // ── OTP tokens (resident WhatsApp login) ──────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS otp_tokens (
      id         SERIAL PRIMARY KEY,
      phone      TEXT NOT NULL,
      otp_code   TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens (phone)`);

    // ── Announcements (secretary → residents) ─────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS announcements (
      id         SERIAL PRIMARY KEY,
      society_id INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      category   TEXT DEFAULT 'GENERAL',
      priority   TEXT DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','URGENT')),
      pinned     BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES auth_accounts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_announcements_society ON announcements (society_id)`);

    // ── Visitor passes (resident → gate) ─────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS visitor_passes (
      id            SERIAL PRIMARY KEY,
      unit_id       INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      society_id    INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      resident_id   INTEGER REFERENCES residents(id) ON DELETE SET NULL,
      visitor_name  TEXT NOT NULL,
      visitor_phone TEXT,
      purpose       TEXT,
      valid_from    TIMESTAMPTZ NOT NULL,
      valid_until   TIMESTAMPTZ NOT NULL,
      vehicle       TEXT,
      pass_code     TEXT UNIQUE NOT NULL,
      status        TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','USED','EXPIRED','REVOKED')),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_visitor_passes_unit     ON visitor_passes (unit_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_visitor_passes_society  ON visitor_passes (society_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_visitor_passes_passcode ON visitor_passes (pass_code)`);

    // ── Month-end closures ────────────────────────────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS monthly_closures (
      id               SERIAL PRIMARY KEY,
      society_id       INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      month            VARCHAR(7) NOT NULL,
      status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
      total_dues       INTEGER DEFAULT 0,
      total_billed     NUMERIC(12,2) DEFAULT 0,
      total_collected  NUMERIC(12,2) DEFAULT 0,
      total_waived     NUMERIC(12,2) DEFAULT 0,
      total_overdue    NUMERIC(12,2) DEFAULT 0,
      total_expenses   NUMERIC(12,2) DEFAULT 0,
      surplus_deficit  NUMERIC(12,2) DEFAULT 0,
      closed_by        INTEGER REFERENCES auth_accounts(id) ON DELETE SET NULL,
      closed_at        TIMESTAMPTZ,
      reopened_by      INTEGER REFERENCES auth_accounts(id) ON DELETE SET NULL,
      reopened_at      TIMESTAMPTZ,
      reopen_reason    TEXT,
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(society_id, month)
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_monthly_closures_society ON monthly_closures (society_id)`);

    await db.query(`CREATE TABLE IF NOT EXISTS maintenance_invoices (
      id             SERIAL PRIMARY KEY,
      due_id         INTEGER NOT NULL REFERENCES maintenance_dues(id) ON DELETE CASCADE,
      society_id     INTEGER NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      generated_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(due_id),
      UNIQUE(invoice_number)
    )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_invoices_society ON maintenance_invoices (society_id)`);

    // ── Guard portal accounts (one per society) ───────────────────────────────
    await db.query(`CREATE TABLE IF NOT EXISTS guard_accounts (
      id            SERIAL PRIMARY KEY,
      society_id    INTEGER NOT NULL UNIQUE REFERENCES societies(id) ON DELETE CASCADE,
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_guard_accounts_username ON guard_accounts (LOWER(username))`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_guard_accounts_society ON guard_accounts (society_id)`);

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
