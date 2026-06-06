/**
 * scripts/reset-db.js
 * ⚠️  DESTRUCTIVE — wipes ALL data and rebuilds the schema from scratch.
 *
 * Usage:
 *   node scripts/reset-db.js
 *   CONFIRM_RESET=yes node scripts/reset-db.js
 */

import bcrypt   from "bcryptjs";
import dotenv   from "dotenv";
import { getDb, ensureSchema } from "../src/db/index.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}

if (process.env.CONFIRM_RESET !== "yes") {
  const safeUrl = process.env.DATABASE_URL.replace(/:\/\/[^@]*@/, "://<credentials>@");
  console.warn(`\n⚠️  WARNING: This will PERMANENTLY DELETE ALL DATA.`);
  console.warn(`   DB: ${safeUrl}\n`);
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(res => rl.question('Type "yes" to continue: ', a => { rl.close(); res(a.trim().toLowerCase()); }));
  if (answer !== "yes") { console.log("Cancelled.\n"); process.exit(0); }
  console.log();
}

const db = getDb();

try {
  process.stdout.write("🗑  Dropping all tables… ");
  await db.query(`
    DROP TABLE IF EXISTS
      maintenance_dues, maintenance_settings,
      ticket_activity_logs, ticket_messages, tickets,
      vendor_documents, vendor_service_areas, vendor_suspensions,
      whatsapp_outbound_messages, whatsapp_sessions, whatsapp_messages,
      auth_accounts, residents, units, floors, towers,
      vendors, users, societies
    CASCADE
  `);
  console.log("✓");

  process.stdout.write("📐  Recreating schema… ");
  const ok = await ensureSchema();
  if (!ok) throw new Error("ensureSchema() failed");
  console.log("✓");

  process.stdout.write("👤  Seeding admin… ");
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT INTO auth_accounts (username, password_hash, portal_role, force_password_reset)
     VALUES ($1, $2, 'NEXSO_ADMIN', FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash],
  );
  console.log("✓");

  console.log(`\n✅  Done. Login: ${username} / ${password}\n`);
} catch (err) {
  console.error("\n❌  Failed:", err.message);
  process.exit(1);
} finally {
  await db.end();
}
