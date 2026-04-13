/*
  Seed sample tickets for local development.
  Usage:
    npm run db:add-tickets
    npm run db:add-tickets -- --count 20 --society "Sunshine Residency"
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

function randomOf(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDescription(category) {
  const byCategory = {
    PLUMBING: ["Kitchen sink is leaking under the cabinet.", "Low water pressure in master bathroom shower.", "Pipe joint near washing machine is dripping."],
    ELECTRICAL: ["Living room lights are flickering frequently.", "Power outlet near TV unit is not working.", "MCB trips when microwave is turned on."],
    SECURITY: ["Main gate camera feed is offline.", "Access card reader at block B is malfunctioning.", "Night patrol not visible in basement area."],
    GENERAL: ["Elevator in tower C is unusually noisy.", "Garbage collection missed on our floor today.", "Common area cleaning is pending since yesterday."],
  };

  return randomOf(byCategory[category] || byCategory.GENERAL);
}

function pickStatus() {
  const weighted = ["OPEN", "OPEN", "ASSIGNED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  return randomOf(weighted);
}

async function ensureSociety(societyName) {
  const existing = await dbQuery("SELECT id FROM societies WHERE name = $1", [societyName]);
  if (existing?.rows?.[0]?.id) return existing.rows[0].id;

  const created = await dbQuery("INSERT INTO societies (name) VALUES ($1) RETURNING id", [societyName]);
  return created?.rows?.[0]?.id;
}

async function ensureUsers(societyId) {
  const users = await dbQuery("SELECT id FROM users WHERE society_id = $1 ORDER BY id ASC", [societyId]);
  if (users?.rows?.length) return users.rows;

  const defaults = [
    ["+911234567890", "OWNER", "Rohan Mehta", "A-101"],
    ["+911234567891", "OWNER", "Anita Sharma", "B-402"],
    ["+911234567892", "OWNER", "Vikram Iyer", "C-305"],
  ];

  for (const [phone, role, name, apartment] of defaults) {
    await dbQuery(
      `INSERT INTO users (whatsapp_number, role, society_id, name, apartment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (whatsapp_number) DO UPDATE
       SET society_id = EXCLUDED.society_id, role = EXCLUDED.role, name = EXCLUDED.name, apartment = EXCLUDED.apartment`,
      [phone, role, societyId, name, apartment],
    );
  }

  const seeded = await dbQuery("SELECT id FROM users WHERE society_id = $1 ORDER BY id ASC", [societyId]);
  return seeded?.rows || [];
}

async function ensureVendors() {
  const defaults = [
    ["PlumbRight Services", "+919999999991", ["PLUMBING"]],
    ["SparkFix Electric", "+919999999992", ["ELECTRICAL"]],
    ["SecureWatch", "+919999999993", ["SECURITY"]],
    ["AllCare Facility", "+919999999994", ["GENERAL"]],
  ];

  for (const [name, whatsapp, categories] of defaults) {
    await dbQuery(
      `INSERT INTO vendors (name, whatsapp_number, categories, active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (whatsapp_number) DO UPDATE
       SET name = EXCLUDED.name, categories = EXCLUDED.categories, active = TRUE`,
      [name, whatsapp, categories],
    );
  }

  const vendors = await dbQuery("SELECT id, categories FROM vendors WHERE active = TRUE");
  return vendors?.rows || [];
}

function findVendorForCategory(vendors, category) {
  return vendors.find((v) => Array.isArray(v.categories) && v.categories.includes(category)) || null;
}

async function main() {
  const args = parseArgs();
  const count = Math.max(1, Number.parseInt(args.count || "12", 10));
  const societyName = args.society || "Sunshine Residency";

  await ensureSchema();

  const societyId = await ensureSociety(societyName);
  if (!societyId) throw new Error("Could not resolve society id");

  const users = await ensureUsers(societyId);
  const vendors = await ensureVendors();
  if (!users.length) throw new Error("No users available to raise tickets");

  const categories = ["PLUMBING", "ELECTRICAL", "SECURITY", "GENERAL"];
  let inserted = 0;

  for (let i = 0; i < count; i++) {
    const category = randomOf(categories);
    const status = pickStatus();
    const raisedBy = randomOf(users);
    const maybeVendor = findVendorForCategory(vendors, category);
    const assignedVendorId = ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status) ? maybeVendor?.id || null : null;
    const ticketId = `T-${Date.now()}-${i + 1}`;

    await dbQuery(
      `INSERT INTO tickets (
        ticket_id,
        society_id,
        raised_by_user_id,
        category,
        description,
        media_urls,
        priority,
        status,
        assigned_vendor_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - ($10::int * INTERVAL '35 minutes'), NOW() - ($10::int * INTERVAL '18 minutes'))`,
      [ticketId, societyId, raisedBy.id, category, randomDescription(category), [], randomOf(["LOW", "NORMAL", "HIGH"]), status, assignedVendorId, count - i],
    );
    inserted += 1;
  }

  console.log(`Inserted ${inserted} tickets for society: ${societyName}`);
}

main().catch((err) => {
  console.error("Failed to add tickets:", err);
  process.exit(1);
});
