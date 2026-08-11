/**
 * scripts/db-cleanup.js
 * ─────────────────────
 * Removes specific test societies and everything belonging to them, leaving
 * real data untouched. This is the go-live cleanup tool.
 *
 *   node scripts/db-cleanup.js --list                      # what's in the DB
 *   node scripts/db-cleanup.js --society TEST1,DEMO        # dry run (default)
 *   node scripts/db-cleanup.js --society TEST1 --apply     # actually delete
 *   node scripts/db-cleanup.js --society TEST1 --apply --purge-global
 *
 * Societies are matched on `code` or numeric `id`. Deleting one cascades to its
 * towers, floors, units, residents, dues, tickets, announcements, events,
 * polls, expenses and portal accounts.
 *
 * `--purge-global` additionally clears data that is NOT scoped to a society and
 * therefore survives a society delete: WhatsApp message logs, OTP tokens, and
 * users left orphaned (users.society_id is ON DELETE SET NULL, not CASCADE).
 *
 * Unlike reset-db.js this never drops tables, so schema objects and FK
 * constraints stay intact.
 */

import dotenv from "dotenv";
import { getDb } from "../src/db/index.js";

dotenv.config();

const APPLY  = process.argv.includes("--apply");
const PURGE  = process.argv.includes("--purge-global");
const LIST   = process.argv.includes("--list");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : null;
}

const db = getDb();

/** Everything that would disappear along with these societies. */
async function impact(ids) {
  const scoped = [
    "towers", "floors", "units", "residents", "tickets", "auth_accounts",
    "guard_accounts", "maintenance_settings", "maintenance_dues",
    "maintenance_expense_sheets", "maintenance_invoices", "monthly_closures",
    "announcements", "visitor_passes", "outbound_broadcasts", "society_events",
    "event_rsvps", "polls", "poll_votes", "society_expenses",
    "society_other_income",
  ];
  const out = {};
  for (const t of scoped) {
    const r = await db.query(`SELECT count(*)::int c FROM "${t}" WHERE society_id = ANY($1::int[])`, [ids]);
    if (r.rows[0].c) out[t] = r.rows[0].c;
  }
  // ticket children hang off tickets, not societies
  for (const t of ["ticket_messages", "ticket_activity_logs"]) {
    const r = await db.query(
      `SELECT count(*)::int c FROM "${t}" WHERE ticket_id IN (SELECT id FROM tickets WHERE society_id = ANY($1::int[]))`,
      [ids],
    );
    if (r.rows[0].c) out[t] = r.rows[0].c;
  }
  return out;
}

async function globalImpact() {
  const q = async (label, sql) => {
    const r = await db.query(sql);
    return [label, r.rows[0].c];
  };
  return Object.fromEntries((await Promise.all([
    q("whatsapp_messages",          "SELECT count(*)::int c FROM whatsapp_messages"),
    q("whatsapp_outbound_messages", "SELECT count(*)::int c FROM whatsapp_outbound_messages"),
    q("whatsapp_sessions",          "SELECT count(*)::int c FROM whatsapp_sessions"),
    q("otp_tokens",                 "SELECT count(*)::int c FROM otp_tokens"),
    q("users (orphaned)",           "SELECT count(*)::int c FROM users WHERE society_id IS NULL"),
  ])).filter(([, c]) => c > 0));
}

try {
  if (LIST) {
    const r = await db.query(`
      SELECT s.id, s.code, s.name, s.created_at::date AS created,
             (SELECT count(*) FROM residents         WHERE society_id = s.id) AS residents,
             (SELECT count(*) FROM maintenance_dues  WHERE society_id = s.id) AS dues,
             (SELECT count(*) FROM tickets           WHERE society_id = s.id) AS tickets
      FROM societies s ORDER BY s.id`);
    console.log("\n  Societies in this database:\n");
    if (!r.rows.length) console.log("    (none)");
    console.table(r.rows);
    console.log("  Delete with:  node scripts/db-cleanup.js --society <code|id> --apply\n");
    process.exit(0);
  }

  const selector = arg("society");
  if (!selector) {
    console.error("\n  Usage: node scripts/db-cleanup.js --society <code|id>[,<code|id>…] [--apply] [--purge-global]");
    console.error("         node scripts/db-cleanup.js --list\n");
    process.exit(1);
  }

  const keys = selector.split(",").map((s) => s.trim()).filter(Boolean);
  const found = await db.query(
    `SELECT id, code, name FROM societies
      WHERE LOWER(code) = ANY($1::text[])
         OR id::text    = ANY($1::text[])`,
    [keys.map((k) => k.toLowerCase())],
  );

  if (!found.rows.length) {
    console.error(`\n  ✗ No societies matched: ${keys.join(", ")}`);
    console.error("    Run with --list to see what exists.\n");
    process.exit(1);
  }

  const matchedKeys = new Set(found.rows.flatMap((r) => [String(r.id), (r.code || "").toLowerCase()]));
  const unmatched = keys.filter((k) => !matchedKeys.has(k.toLowerCase()));
  if (unmatched.length) {
    console.error(`\n  ✗ These did not match any society: ${unmatched.join(", ")}`);
    console.error("    Nothing was deleted — fix the list and re-run.\n");
    process.exit(1);
  }

  const ids = found.rows.map((r) => r.id);

  console.log(`\n  ${APPLY ? "DELETING" : "DRY RUN — would delete"} ${found.rows.length} society/societies:\n`);
  found.rows.forEach((r) => console.log(`    [${r.id}] ${r.code || "(no code)"} — ${r.name}`));

  const rows = await impact(ids);
  console.log("\n  Dependent rows:\n");
  if (!Object.keys(rows).length) console.log("    (none)");
  Object.entries(rows).forEach(([t, c]) => console.log(`    ${t.padEnd(30)} ${c}`));

  if (PURGE) {
    const g = await globalImpact();
    console.log("\n  Global (non-society) data --purge-global would clear:\n");
    if (!Object.keys(g).length) console.log("    (none)");
    Object.entries(g).forEach(([t, c]) => console.log(`    ${t.padEnd(30)} ${c}`));
  }

  if (!APPLY) {
    console.log("\n  Nothing was changed. Re-run with --apply to execute.");
    console.log("  Take a backup first:  npm run db:backup -- --label pre-cleanup\n");
    process.exit(0);
  }

  await db.query("BEGIN");
  const del = await db.query("DELETE FROM societies WHERE id = ANY($1::int[]) RETURNING id", [ids]);

  let purged = {};
  if (PURGE) {
    const wipe = async (label, sql) => {
      const r = await db.query(sql);
      if (r.rowCount) purged[label] = r.rowCount;
    };
    await wipe("whatsapp_messages",          "DELETE FROM whatsapp_messages");
    await wipe("whatsapp_outbound_messages", "DELETE FROM whatsapp_outbound_messages");
    await wipe("whatsapp_sessions",          "DELETE FROM whatsapp_sessions");
    await wipe("otp_tokens",                 "DELETE FROM otp_tokens");
    await wipe("users (orphaned)",           "DELETE FROM users WHERE society_id IS NULL");
  }
  await db.query("COMMIT");

  // Confirm nothing was left behind pointing at the deleted societies.
  const leftover = await impact(ids);
  if (Object.keys(leftover).length) {
    console.error("\n  ⚠ Rows still referencing deleted societies:", leftover);
    console.error("    Investigate before going live.\n");
    process.exitCode = 1;
  } else {
    console.log(`\n  ✓ Deleted ${del.rowCount} society/societies — no orphaned rows remain.`);
    if (PURGE && Object.keys(purged).length) {
      console.log("\n  Purged global data:");
      Object.entries(purged).forEach(([t, c]) => console.log(`    ${t.padEnd(30)} ${c}`));
    }
    console.log("");
  }
} catch (err) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(`\n  ✗ Cleanup FAILED (rolled back): ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
