/**
 * scripts/reset-db.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  DESTRUCTIVE — wipes ALL data and rebuilds the schema from scratch.
 *
 * Usage (run from the backend/ directory):
 *   node scripts/reset-db.js                       # interactive confirmation
 *   CONFIRM_RESET=yes node scripts/reset-db.js     # skip prompt (useful in dev)
 *
 * Optional env overrides:
 *   ADMIN_USERNAME=admin   (default: "admin")
 *   ADMIN_PASSWORD=secret  (default: "admin123")
 *
 * What it does:
 *   1. Drops every known table (CASCADE — order doesn't matter)
 *   2. Recreates all base tables via ensureSchema()
 *   3. Applies extra tables not covered by ensureSchema
 *      (vendor_documents, vendor_service_areas, vendor_suspensions)
 *   4. Runs migrations 002 → 006 (idempotent; 001 is data-only, skipped)
 *   5. Seeds the default NEXSO_ADMIN account
 */

import { readFileSync }  from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath }  from "url";
import * as readline      from "readline";
import bcrypt             from "bcryptjs";
import dotenv             from "dotenv";
import { getDb, ensureSchema } from "../src/db/index.js";

dotenv.config();

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, "..");

// ── Helpers ────────────────────────────────────────────────────────────────────

function readSql(relPath) {
  return readFileSync(resolve(root, relPath), "utf8");
}

async function promptUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => { rl.close(); res(answer.trim().toLowerCase()); });
  });
}

async function step(label, fn) {
  process.stdout.write(`  ${label}… `);
  await fn();
  process.stdout.write("✓\n");
}

// ── Confirmation gate ──────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Check backend/.env");
  process.exit(1);
}

if (process.env.CONFIRM_RESET !== "yes") {
  const safeUrl = process.env.DATABASE_URL.replace(/:\/\/[^@]*@/, "://<credentials>@");
  console.warn(`\n⚠️   WARNING: This will PERMANENTLY DELETE ALL DATA in your database.`);
  console.warn(`    DB: ${safeUrl}\n`);
  const answer = await promptUser('Type "yes" to continue, anything else to cancel: ');
  if (answer !== "yes") {
    console.log("\nReset cancelled — no changes made.\n");
    process.exit(0);
  }
  console.log();
}

// ── Main ───────────────────────────────────────────────────────────────────────

const db = getDb();

try {
  // ── Step 1: Drop all known tables ────────────────────────────────────────────
  console.log("🗑   Dropping all tables…");

  // Leaf tables first so FK deps don't matter, but CASCADE handles it anyway.
  await step("drop all", () => db.query(`
    DROP TABLE IF EXISTS
      maintenance_dues,
      maintenance_settings,
      ticket_activity_logs,
      ticket_messages,
      tickets,
      vendor_documents,
      vendor_service_areas,
      vendor_suspensions,
      whatsapp_outbound_messages,
      whatsapp_sessions,
      whatsapp_messages,
      auth_accounts,
      residents,
      units,
      floors,
      towers,
      vendors,
      users,
      societies
    CASCADE
  `));

  // ── Step 2: Recreate base schema ──────────────────────────────────────────────
  // ensureSchema() creates: societies (+ all extra columns), users, vendors,
  // tickets, ticket_messages, ticket_activity_logs, whatsapp_messages,
  // whatsapp_sessions, towers, floors, units, residents, auth_accounts (base).
  console.log("\n📐  Recreating schema…");

  const ok = await ensureSchema();
  if (!ok) throw new Error("ensureSchema() returned false — check DB logs above.");
  process.stdout.write("  ensureSchema… ✓\n");

  // Extra tables ensureSchema doesn't cover (originally in docs/schema.sql)
  await step("vendor_documents",     () => db.query(`
    CREATE TABLE IF NOT EXISTS vendor_documents (
      id          SERIAL PRIMARY KEY,
      vendor_id   INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
      doc_type    TEXT,
      filename    TEXT,
      url         TEXT,
      metadata    JSONB,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `));

  await step("vendor_service_areas", () => db.query(`
    CREATE TABLE IF NOT EXISTS vendor_service_areas (
      id          SERIAL PRIMARY KEY,
      vendor_id   INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
      building_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
      region      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `));

  await step("vendor_suspensions",   () => db.query(`
    CREATE TABLE IF NOT EXISTS vendor_suspensions (
      id           SERIAL PRIMARY KEY,
      vendor_id    INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
      reason       TEXT,
      suspended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      suspended_at TIMESTAMPTZ DEFAULT NOW(),
      restored_at  TIMESTAMPTZ
    )
  `));

  // ── Step 3: Migrations ────────────────────────────────────────────────────────
  // 001 — data-normalization only (vendor category strings); skip on empty DB.
  // 002 — auth_accounts table; already created above, IF NOT EXISTS = no-op.
  // 003 — adds vendor_id column + updates portal_role CHECK on auth_accounts.
  // 004 — creates maintenance_settings + maintenance_dues tables.
  // 005 — adds Razorpay columns to maintenance_dues.
  console.log("\n🔄  Running migrations…");

  await step("002_auth_accounts", () => db.query(readSql("docs/migrations/002_auth_accounts.sql")));
  await step("003_vendor_auth",   () => db.query(readSql("docs/migrations/003_vendor_auth.sql")));
  await step("004_maintenance",     () => db.query(readSql("docs/migrations/004_maintenance.sql")));
  await step("005_razorpay",        () => db.query(readSql("docs/migrations/005_razorpay.sql")));
  await step("006_unit_occupancy",  () => db.query(readSql("docs/migrations/006_unit_occupancy.sql")));

  // ── Step 4: Seed admin ────────────────────────────────────────────────────────
  console.log("\n👤  Seeding admin account…");

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash     = await bcrypt.hash(password, 12);

  await step(`create "${username}"`, () => db.query(
    `INSERT INTO auth_accounts
       (username, password_hash, portal_role, society_id, force_password_reset)
     VALUES ($1, $2, 'NEXSO_ADMIN', NULL, FALSE)
     ON CONFLICT (username) DO UPDATE
       SET password_hash        = EXCLUDED.password_hash,
           portal_role          = 'NEXSO_ADMIN',
           force_password_reset = FALSE`,
    [username, hash],
  ));

  // ── Done ──────────────────────────────────────────────────────────────────────
  console.log(`\n✅  Database reset complete!`);
  console.log(`    Admin login → ${username} / ${password}`);
  if (password === "admin123") {
    console.log(`    ⚠️  Using default password — change it after first login!`);
  }
  console.log();

} catch (err) {
  console.error("\n❌  Reset failed:", err.message);
  process.exit(1);
} finally {
  await db.end();
}
