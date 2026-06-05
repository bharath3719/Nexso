/**
 * scripts/seed-vendor.js
 * ───────────────────────
 * Creates a VENDOR auth account linked to an existing vendor record.
 * Safe to run multiple times for different vendor IDs.
 *
 * Usage:
 *   VENDOR_ID=1 VENDOR_USERNAME=vendor1 VENDOR_PASSWORD=pass123 node scripts/seed-vendor.js
 *
 * Defaults: VENDOR_USERNAME=vendor1, VENDOR_PASSWORD=vendor123
 * VENDOR_ID is required — find it in the vendors table.
 *
 * Example workflow:
 *   1. Create the vendor via the admin UI (Vendors → Add Vendor).
 *   2. Note the vendor's DB id (shown in the admin vendor list URL or logs).
 *   3. Run: VENDOR_ID=5 VENDOR_USERNAME=plumber1 node scripts/seed-vendor.js
 *   4. The vendor can now log in at the portal with those credentials.
 */

import bcrypt  from "bcryptjs";
import pg      from "pg";
import dotenv  from "dotenv";

dotenv.config();

const vendorId = Number(process.env.VENDOR_ID);
const username = process.env.VENDOR_USERNAME || "vendor1";
const password = process.env.VENDOR_PASSWORD || "vendor123";

if (!vendorId || Number.isNaN(vendorId)) {
  console.error("❌  VENDOR_ID environment variable is required.");
  console.error("    Usage: VENDOR_ID=<id> node scripts/seed-vendor.js");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  // Verify the vendor exists
  const vendorCheck = await client.query(
    `SELECT id, name FROM vendors WHERE id = $1`,
    [vendorId],
  );
  if (!vendorCheck.rows.length) {
    console.error(`❌  No vendor found with id=${vendorId}.`);
    process.exit(1);
  }
  const vendor = vendorCheck.rows[0];

  // Check if account already exists
  const existing = await client.query(
    `SELECT id FROM auth_accounts WHERE LOWER(username) = LOWER($1)`,
    [username],
  );

  if (existing.rows.length > 0) {
    console.log(`✓ Vendor account "${username}" already exists — no changes made.`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO auth_accounts
         (username, password_hash, portal_role, society_id, vendor_id, force_password_reset)
       VALUES ($1, $2, 'VENDOR', NULL, $3, TRUE)`,
      [username, hash, vendorId],
    );
    console.log(`✓ Vendor account created for "${vendor.name}" (id=${vendorId}).`);
    console.log(`  Username : ${username}`);
    console.log(`  Password : ${password}  ← vendor will be prompted to change this`);
    console.log(`\n  ⚠️  The vendor must change their password on first login.`);
  }
} catch (err) {
  console.error("seed-vendor failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
