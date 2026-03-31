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
    const database = process.env.PGDATABASE || "postgres";
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

    await db.query(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id SERIAL PRIMARY KEY,
      whatsapp_number TEXT UNIQUE NOT NULL,
      state TEXT NOT NULL DEFAULT 'awaiting_society',
      context JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);

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
