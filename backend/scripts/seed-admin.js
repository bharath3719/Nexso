/**
 * scripts/seed-admin.js
 * ─────────────────────
 * Creates the initial NEXSO_ADMIN auth account.
 * Safe to run multiple times — won't duplicate the record.
 *
 * Usage:
 *   node scripts/seed-admin.js
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=mypassword node scripts/seed-admin.js
 *
 * Defaults: username=admin, password=admin123
 */

import bcrypt  from "bcryptjs";
import pg      from "pg";
import dotenv  from "dotenv";

dotenv.config();

const username = process.env.ADMIN_USERNAME || "admin";
const password = process.env.ADMIN_PASSWORD || "admin123";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  // Check if already exists
  const existing = await client.query(
    `SELECT id FROM auth_accounts WHERE LOWER(username) = LOWER($1)`,
    [username],
  );

  if (existing.rows.length > 0) {
    console.log(`✓ Admin account "${username}" already exists — no changes made.`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO auth_accounts (username, password_hash, portal_role, society_id, force_password_reset)
       VALUES ($1, $2, 'NEXSO_ADMIN', NULL, FALSE)`,
      [username, hash],
    );
    console.log(`✓ Admin account created.`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log(`\n  ⚠️  Change this password after first login in production!`);
  }
} catch (err) {
  console.error("seed-admin failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
