/*
  Register a user by WhatsApp number into a society.
  Usage:
    npm run db:add-user -- --phone +911234567891 --role OWNER --society "Sunshine Residency"

  Defaults:
    --role OWNER
    --society "Sunshine Residency"
*/

import { ensureSchema, dbQuery } from "../src/db/index.js";

function parseArgs() {
  const out = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const phone = args.phone || args.whatsapp || args.number;
  const name = args.name || null;
  const apartment = args.apartment || args.flat || null;
  if (!phone) {
    console.error("Missing --phone <E.164 number> argument");
    process.exit(1);
  }
  const role = (args.role || "OWNER").toUpperCase();
  const societyName = args.society || "Sunshine Residency";

  await ensureSchema();

  // Ensure society exists
  let s = await dbQuery("SELECT id FROM societies WHERE name = $1", [societyName]);
  let societyId = s?.rows?.[0]?.id || null;
  if (!societyId) {
    const ins = await dbQuery("INSERT INTO societies (name) VALUES ($1) RETURNING id", [societyName]);
    societyId = ins?.rows?.[0]?.id;
  }

  // Insert user if missing
  const existing = await dbQuery("SELECT id FROM users WHERE whatsapp_number = $1", [phone]);
  if (existing?.rows?.[0]) {
    const updated = await dbQuery("UPDATE users SET role = $2, society_id = $3, name = COALESCE($4, name), apartment = COALESCE($5, apartment) WHERE whatsapp_number = $1 RETURNING id, whatsapp_number, name, role, society_id, apartment", [phone, role, societyId, name, apartment]);
    console.log("User updated:", updated?.rows?.[0] || {});
    process.exit(0);
  }

  const u = await dbQuery("INSERT INTO users (whatsapp_number, role, society_id, name, apartment) VALUES ($1, $2, $3, $4, $5) RETURNING id, whatsapp_number, name, role, society_id, apartment", [phone, role, societyId, name, apartment]);
  console.log("User created:", u?.rows?.[0] || {});
}

main().catch((err) => {
  console.error("Failed to add user:", err);
  process.exit(1);
});
