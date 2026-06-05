/**
 * scripts/migrate.js
 * Runs a SQL migration file using the existing pg connection.
 *
 * Usage:
 *   node scripts/migrate.js docs/migrations/001_normalize_vendor_categories.sql
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/migrate.js <path-to-sql-file>");
  process.exit(1);
}

const sql = readFileSync(resolve(filePath), "utf8");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  console.log("Connected. Running migration…\n");
  const result = await client.query(sql);

  // result may be an array if multiple statements were run
  const results = Array.isArray(result) ? result : [result];
  results.forEach((r, i) => {
    if (r.rowCount !== null) console.log(`  Statement ${i + 1}: ${r.rowCount} row(s) affected`);
  });

  console.log("\n✓ Migration complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
