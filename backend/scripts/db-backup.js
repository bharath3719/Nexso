/**
 * scripts/db-backup.js
 * ────────────────────
 * Takes a compressed, verified snapshot of the database.
 *
 *   npm run db:backup
 *   npm run db:backup -- --label pre-golive-cleanup
 *   BACKUP_DIR=/mnt/backups npm run db:backup
 *
 * Writes  <BACKUP_DIR>/nexso-<label>-<UTC timestamp>.dump  (pg_dump custom
 * format, restorable with scripts/db-restore.js) plus a .json manifest holding
 * the row counts at dump time — that manifest is what makes a restore
 * verifiable rather than hopeful.
 *
 * Custom format (-Fc) rather than plain SQL because it can be restored
 * selectively, in parallel, and is compressed by default.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getDb } from "../src/db/index.js";

dotenv.config();

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
const RETAIN = Number(process.env.BACKUP_RETAIN || 14);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function connInfo() {
  const url = process.env.DATABASE_URL;
  if (url) return { env: { ...process.env, PGPASSWORD: undefined }, args: ["-d", url] };

  // Fall back to discrete vars, mirroring src/db/index.js
  return {
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || "postgres" },
    args: [
      "-h", process.env.PGHOST || "127.0.0.1",
      "-p", String(process.env.PGPORT || 5432),
      "-U", process.env.PGUSER || "postgres",
      "-d", process.env.PGDATABASE || "nexso",
    ],
  };
}

function run(cmd, args, env, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: ["ignore", quiet ? "pipe" : "inherit", "pipe"] });
    let stderr = "";
    if (quiet) p.stdout.on("data", () => {}); // drain, don't print
    p.stderr.on("data", (d) => { stderr += d; });
    p.on("error", (e) => reject(
      e.code === "ENOENT"
        ? new Error(`${cmd} not found on PATH. Install the PostgreSQL client tools, or add its bin directory to PATH.`)
        : e,
    ));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${stderr}`))));
  });
}

/** Row counts for every public table — the restore check compares against these. */
async function snapshotCounts() {
  const db = getDb();
  const { rows: tables } = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const counts = {};
  for (const { tablename } of tables) {
    const r = await db.query(`SELECT count(*)::int AS c FROM "${tablename}"`);
    counts[tablename] = r.rows[0].c;
  }
  return counts;
}

/** Delete dumps older than the newest RETAIN, so the directory can't grow forever. */
function pruneOldBackups() {
  const dumps = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  for (const { f } of dumps.slice(RETAIN)) {
    fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
    fs.rmSync(path.join(BACKUP_DIR, f.replace(/\.dump$/, ".json")), { force: true });
    console.log(`  pruned old backup: ${f}`);
  }
}

const label = (arg("label", "auto") || "auto").replace(/[^a-zA-Z0-9._-]/g, "-");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
const base  = `nexso-${label}-${stamp}`;
const dumpPath     = path.join(BACKUP_DIR, `${base}.dump`);
const manifestPath = path.join(BACKUP_DIR, `${base}.json`);

fs.mkdirSync(BACKUP_DIR, { recursive: true });

try {
  const { env, args } = connInfo();

  console.log(`\n  Backing up → ${dumpPath}`);
  await run("pg_dump", [...args, "--format=custom", "--no-owner", "--no-privileges", "--file", dumpPath], env);

  const stat = fs.statSync(dumpPath);
  if (stat.size === 0) throw new Error("pg_dump produced an empty file");

  // Prove the archive is readable before we call it a backup. A dump that
  // can't be listed is not a backup, it's a file.
  console.log("  Verifying archive is readable…");
  await run("pg_restore", ["--list", dumpPath], env, { quiet: true });

  const counts = await snapshotCounts();
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);

  fs.writeFileSync(manifestPath, JSON.stringify({
    created_at: new Date().toISOString(),
    label,
    dump_file: path.basename(dumpPath),
    bytes: stat.size,
    total_rows: total,
    row_counts: counts,
  }, null, 2));

  pruneOldBackups();

  console.log(`\n  ✓ Backup complete`);
  console.log(`    file    : ${dumpPath}`);
  console.log(`    size    : ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    rows    : ${total} across ${Object.keys(counts).length} tables`);
  console.log(`    manifest: ${manifestPath}`);
  console.log(`\n    Restore with:  node scripts/db-restore.js --file ${path.basename(dumpPath)}\n`);
} catch (err) {
  console.error(`\n  ✗ Backup FAILED: ${err.message}\n`);
  fs.rmSync(dumpPath, { force: true });
  process.exitCode = 1;
} finally {
  await getDb().end().catch(() => {});
}
