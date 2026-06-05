import { dbQuery } from "../db/index.js";

export async function findVendorsFor(societyId, category) {
  const res = await dbQuery(
    "SELECT * FROM vendors WHERE $1 = ANY(categories) AND active = TRUE",
    [category],
  );
  return res && res.rows ? res.rows : [];
}

export async function chooseVendor(vendors) {
  // Simple first-available; replace with round-robin using DB state later
  return vendors[0] || null;
}
