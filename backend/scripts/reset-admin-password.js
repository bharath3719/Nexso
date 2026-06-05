/**
 * scripts/reset-admin-password.js
 * Reset the admin account password to a known value.
 * Usage: node scripts/reset-admin-password.js [username] [newPassword]
 * Defaults: username=admin, password=admin123
 */
import dotenv  from "dotenv";
import bcrypt  from "bcryptjs";
import pg      from "pg";

dotenv.config();

const username = process.argv[2] || "admin";
const password = process.argv[3] || "admin123";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const hash = await bcrypt.hash(password, 12);
  const r = await client.query(
    `UPDATE auth_accounts
       SET password_hash = $1, force_password_reset = FALSE
     WHERE LOWER(username) = LOWER($2)
     RETURNING id, username, portal_role`,
    [hash, username],
  );

  if (r.rows.length === 0) {
    // Insert if not found
    await client.query(
      `INSERT INTO auth_accounts (username, password_hash, portal_role, society_id, force_password_reset)
       VALUES ($1, $2, 'NEXSO_ADMIN', NULL, FALSE)`,
      [username, hash],
    );
    console.log(`✓ Created account "${username}" with password "${password}"`);
  } else {
    console.log(`✓ Password reset for "${r.rows[0].username}" (${r.rows[0].portal_role})`);
    console.log(`  New password: ${password}`);
  }
} catch (err) {
  console.error("Failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
