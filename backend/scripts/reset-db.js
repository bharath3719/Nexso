/**
 * scripts/reset-db.js
 * ⚠️  DESTRUCTIVE — wipes ALL data and rebuilds the schema from scratch.
 *
 * Usage:
 *   node scripts/reset-db.js
 *   CONFIRM_RESET=yes node scripts/reset-db.js
 */

import bcrypt   from "bcryptjs";
import crypto   from "crypto";
import dotenv   from "dotenv";
import { getDb, ensureSchema } from "../src/db/index.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}

// This script exists for rebuilding a dev database. Against production it is
// unrecoverable data loss — use scripts/db-cleanup.js to remove test societies
// without touching the rest.
if (process.env.NODE_ENV === "production" && process.env.I_UNDERSTAND_THIS_DESTROYS_PRODUCTION !== "yes") {
  console.error("❌  Refusing to run against NODE_ENV=production.");
  console.error("    To remove test data from a live database use:");
  console.error("      node scripts/db-cleanup.js --list");
  console.error("      node scripts/db-cleanup.js --society <code> --apply\n");
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
  // Drop every table in the public schema rather than a hand-maintained list.
  // The old explicit list had drifted seven tables behind the schema
  // (outbound_broadcasts, society_events, event_rsvps, polls, poll_votes,
  // society_expenses, society_other_income). Those survived the "wipe" with
  // their rows intact while CASCADE silently removed their foreign keys — so
  // stale rows then re-attached themselves to whichever society reused the id.
  process.stdout.write("🗑  Dropping all tables… ");
  const { rows: tables } = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  if (tables.length) {
    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await db.query(`DROP TABLE IF EXISTS ${list} CASCADE`);
  }
  console.log(`✓ (${tables.length})`);

  process.stdout.write("📐  Recreating schema… ");
  const ok = await ensureSchema();
  if (!ok) throw new Error("ensureSchema() failed");
  console.log("✓");

  process.stdout.write("👤  Seeding admin… ");
  const username = process.env.ADMIN_USERNAME || "admin";
  // Generate a random password when ADMIN_PASSWORD isn't supplied. The old
  // "admin123" default meant every reset DB shipped the same known credential,
  // and force_password_reset was FALSE so nothing ever prompted a change.
  const generated = !process.env.ADMIN_PASSWORD;
  const password  = process.env.ADMIN_PASSWORD || `Nx-${crypto.randomBytes(9).toString("base64url")}`;
  const hash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT INTO auth_accounts (username, password_hash, portal_role, force_password_reset)
     VALUES ($1, $2, 'NEXSO_ADMIN', $3)
     ON CONFLICT (username) DO UPDATE
       SET password_hash        = EXCLUDED.password_hash,
           force_password_reset = EXCLUDED.force_password_reset`,
    [username, hash, generated],
  );
  console.log("✓");

  console.log(`\n✅  Done. Login: ${username} / ${password}`);
  if (generated) console.log("    (randomly generated — save it now, it is not stored anywhere)\n");
  else console.log("");
} catch (err) {
  console.error("\n❌  Failed:", err.message);
  process.exit(1);
} finally {
  await db.end();
}
