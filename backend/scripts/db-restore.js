/**
 * scripts/db-restore.js
 * ─────────────────────
 * Restores a dump produced by db-backup.js, then verifies the row counts
 * against that dump's manifest.
 *
 *   # rehearse into a throwaway database (ALWAYS do this first)
 *   node scripts/db-restore.js --file nexso-auto-2026-08-07T10-00-00Z.dump --into nexso_restore_test
 *
 *   # real recovery, over the live database
 *   node scripts/db-restore.js --file <dump> --target-url "$DATABASE_URL" --confirm
 *
 * `--into <name>` creates a fresh database on the same server and restores
 * there — non-destructive, and the only mode that runs without --confirm.
 * Restoring over an existing database requires --confirm because it drops and
 * recreates every object it owns.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

function run(cmd, args, env, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => { stderr += d; process.stderr.write(d); });
    p.on("error", (e) => reject(
      e.code === "ENOENT"
        ? new Error(`${cmd} not found on PATH. Install the PostgreSQL client tools.`)
        : e,
    ));
    p.on("close", (code) => (code === 0 || allowFailure ? resolve(stderr) : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** Swap the database name in a postgres:// URL. */
function urlWithDb(url, dbName) {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

function baseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.PGHOST || "127.0.0.1";
  const port = process.env.PGPORT || 5432;
  const user = process.env.PGUSER || "postgres";
  const pass = process.env.PGPASSWORD || "postgres";
  const db   = process.env.PGDATABASE || "nexso";
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

const file = arg("file");
if (!file) {
  console.error("\n  Usage: node scripts/db-restore.js --file <dump> [--into <newdb> | --target-url <url> --confirm]\n");
  const dumps = fs.existsSync(BACKUP_DIR)
    ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".dump")).sort().reverse()
    : [];
  if (dumps.length) {
    console.error("  Available backups:");
    dumps.slice(0, 10).forEach((d) => console.error(`    ${d}`));
    console.error("");
  }
  process.exit(1);
}

const dumpPath = path.isAbsolute(file) ? file : path.join(BACKUP_DIR, file);
if (!fs.existsSync(dumpPath)) {
  console.error(`\n  ✗ Dump not found: ${dumpPath}\n`);
  process.exit(1);
}

const into      = arg("into");
const targetUrl = arg("target-url");

if (!into && !targetUrl) {
  console.error("\n  ✗ Specify --into <newdb> (safe rehearsal) or --target-url <url> --confirm (destructive).\n");
  process.exit(1);
}
if (targetUrl && !has("confirm")) {
  console.error("\n  ✗ Restoring over an existing database drops and recreates its objects.");
  console.error("    Re-run with --confirm if that is what you intend.\n");
  process.exit(1);
}

const env = { ...process.env, PGPASSWORD: process.env.PGPASSWORD || "postgres" };

try {
  let destUrl = targetUrl;

  if (into) {
    const admin = new pg.Client({ connectionString: urlWithDb(baseUrl(), "postgres") });
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [into]);
    if (exists.rows.length) {
      console.error(`\n  ✗ Database "${into}" already exists. Drop it first or pick another name.\n`);
      await admin.end();
      process.exit(1);
    }
    console.log(`\n  Creating rehearsal database "${into}"…`);
    await admin.query(`CREATE DATABASE "${into}"`);
    await admin.end();
    destUrl = urlWithDb(baseUrl(), into);
  }

  console.log(`  Restoring ${path.basename(dumpPath)} …`);
  // --clean --if-exists so a re-restore over the same target is repeatable.
  // pg_restore reports non-zero for benign notices, so inspect output instead.
  const stderr = await run("pg_restore", [
    "--dbname", destUrl, "--no-owner", "--no-privileges",
    ...(targetUrl ? ["--clean", "--if-exists"] : []),
    dumpPath,
  ], env, { allowFailure: true });

  if (/FATAL|could not connect/i.test(stderr)) throw new Error("pg_restore could not connect");

  // ── Verify against the manifest ────────────────────────────────────────────
  const manifestPath = dumpPath.replace(/\.dump$/, ".json");
  if (!fs.existsSync(manifestPath)) {
    console.log("\n  ⚠ No manifest beside this dump — restored, but row counts are unverified.\n");
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const client = new pg.Client({ connectionString: destUrl });
    await client.connect();

    const mismatches = [];
    let checked = 0;
    for (const [table, expected] of Object.entries(manifest.row_counts)) {
      let actual;
      try {
        actual = (await client.query(`SELECT count(*)::int AS c FROM "${table}"`)).rows[0].c;
      } catch {
        mismatches.push(`${table}: MISSING from restore`);
        continue;
      }
      checked++;
      if (actual !== expected) mismatches.push(`${table}: expected ${expected}, got ${actual}`);
    }
    await client.end();

    console.log(`\n  Verified ${checked}/${Object.keys(manifest.row_counts).length} tables against manifest.`);
    if (mismatches.length) {
      console.error("\n  ✗ RESTORE VERIFICATION FAILED:");
      mismatches.forEach((m) => console.error(`      ${m}`));
      console.error("");
      process.exit(1);
    }
    console.log(`  ✓ All row counts match (${manifest.total_rows} rows).`);
  }

  console.log(`\n  ✓ Restore complete → ${into || "target database"}\n`);
  if (into) console.log(`    Drop the rehearsal DB when done:  DROP DATABASE "${into}";\n`);
} catch (err) {
  console.error(`\n  ✗ Restore FAILED: ${err.message}\n`);
  process.exit(1);
}
