import { dbQuery } from "../db/index.js";

export async function findVendorsFor(societyId, category) {
  const res = await dbQuery("SELECT * FROM vendors WHERE society_id = $1 AND $2 = ANY(categories) AND active = TRUE", [societyId, category]);
  return res && res.rows ? res.rows : [];
}

export async function chooseVendor(vendors) {
  // Simple first-available; replace with round-robin using DB state later
  return vendors[0] || null;
}
