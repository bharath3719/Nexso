/**
 * scripts/apply-schema.js
 * ───────────────────────
 * Applies the database schema by running ensureSchema() — the same function the
 * server runs on every boot (src/index.js). This is the single source of truth
 * for the schema; there is no .sql file to keep in step with it.
 *
 * You rarely need this: starting the backend applies the schema already. It's
 * here for provisioning a fresh database, or running a migration on a deployed
 * one, without bringing the server up.
 *
 * Safe to run multiple times — every statement is CREATE/ALTER ... IF NOT EXISTS
 * or an idempotent constraint swap.
 *
 * Usage:
 *   npm run db:schema
 */

import dotenv from "dotenv";
dotenv.config();

const { ensureSchema, getDb } = await import("../src/db/index.js");

try {
  // ensureSchema() swallows its own errors and returns false after rolling the
  // whole migration back, so a falsy return is the real failure signal here —
  // the underlying Postgres error is on the line it logged just above.
  const ok = await ensureSchema();
  if (!ok) {
    console.error("✗ Schema NOT applied — the migration rolled back. See the error logged above.");
    process.exit(1);
  }
  console.log("✓ Schema applied.");
} catch (err) {
  console.error("apply-schema failed:", err.message);
  process.exit(1);
} finally {
  await getDb()?.end();
}
