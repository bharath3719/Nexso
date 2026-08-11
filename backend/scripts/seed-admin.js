/**
 * scripts/seed-admin.js
 * ─────────────────────
 * Creates the initial NEXSO_ADMIN account, or resets its password if it already
 * exists. Idempotent — safe to run repeatedly.
 *
 *   npm run db:seed-admin                          # random password, printed once
 *   npm run db:seed-admin -- --username ops        # pick the username
 *   ADMIN_PASSWORD=... npm run db:seed-admin       # supply your own
 *
 * The password is only ever printed, never stored anywhere else. If you lose it,
 * re-run this to set a new one — that is the lockout-recovery path.
 *
 * (Supersedes the old reset-admin-password.js, which did the same thing with a
 * hardcoded "admin123" default.)
 */

import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDb } from "../src/db/index.js";

dotenv.config();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : fallback;
}

const username = arg("username", process.env.ADMIN_USERNAME || "admin");

// A generated password beats a documented default: "admin123" shipped in the
// docstring meant every deployment that skipped this step had the same known
// credential for a full-platform admin account.
const supplied  = process.env.ADMIN_PASSWORD || arg("password");
const password  = supplied || `Nx-${crypto.randomBytes(9).toString("base64url")}`;

if (supplied && supplied.length < 12) {
  console.error("\n  ✗ Password must be at least 12 characters.\n");
  process.exit(1);
}

const db = getDb();

try {
  const hash = await bcrypt.hash(password, 12);

  // force_password_reset is set when we generated the password, so the operator
  // is prompted to replace it rather than leaving a script-issued secret live.
  const r = await db.query(
    `INSERT INTO auth_accounts (username, password_hash, portal_role, society_id, force_password_reset)
     VALUES ($1, $2, 'NEXSO_ADMIN', NULL, $3)
     ON CONFLICT (username) DO UPDATE
       SET password_hash        = EXCLUDED.password_hash,
           force_password_reset = EXCLUDED.force_password_reset
     RETURNING id, username, portal_role, (xmax = 0) AS created`,
    [username, hash, !supplied],
  );

  const row = r.rows[0];
  console.log(`\n  ✓ ${row.created ? "Created" : "Password reset for"} ${row.portal_role} account "${row.username}"`);
  console.log(`\n    username: ${row.username}`);
  console.log(`    password: ${password}`);
  if (!supplied) console.log(`\n    Randomly generated — save it now, it is not stored anywhere.`);
  console.log("");
} catch (err) {
  console.error(`\n  ✗ Failed: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
