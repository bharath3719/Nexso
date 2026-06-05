import { dbQuery } from "../db/index.js";
import { Roles } from "../utils/stateMachine.js";

// Resolve a WhatsApp number to either a `users` entry or a `residents` entry.
// Returns an identity object containing at least `role` and `society_id`.
export async function resolveIdentity(whatsappNumber) {
  if (!whatsappNumber) return { role: "UNKNOWN" };
  // Normalize to digits-only for comparisons (handles +91 vs 91 formatting)
  const digits = String(whatsappNumber).replace(/\D/g, "");

  // 1) Try users table (explicit app users)
  // Match on last 10 digits so +91/91 prefix differences don't matter
  const ures = await dbQuery(
    "SELECT * FROM users WHERE RIGHT(regexp_replace(COALESCE(whatsapp_number,''), '\\D', '', 'g'), 10) = RIGHT($1, 10) LIMIT 1",
    [digits],
  );
  const user = ures && ures.rows && ures.rows[0] ? ures.rows[0] : null;
  if (user) {
    const role = user.role || Roles.OWNER;
    return { role, user_id: user.id, society_id: user.society_id, name: user.name || null, whatsapp_number: whatsappNumber };
  }

  // 2) Fallback: look up residents table (registered residents are allowed to interact)
  const rres = await dbQuery(
    "SELECT * FROM residents WHERE RIGHT(regexp_replace(COALESCE(phone,''), '\\D', '', 'g'), 10) = RIGHT($1, 10) LIMIT 1",
    [digits],
  );
  const resident = rres?.rows?.[0] ?? null;
  if (resident) {
    // Current-occupant check: if the unit has a TENANT and this resident is the OWNER,
    // the owner is not the current occupant — block ticket creation.
    if (resident.resident_type === "OWNER" && resident.unit_id) {
      const tenantCheck = await dbQuery(
        `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = 'TENANT' LIMIT 1`,
        [resident.unit_id],
      );
      if (tenantCheck?.rows?.length > 0) {
        return { role: "NOT_OCCUPANT", whatsapp_number: whatsappNumber };
      }
    }

    // If already linked to a users row, return that user's identity
    if (resident.user_id) {
      const ures2 = await dbQuery("SELECT * FROM users WHERE id = $1", [resident.user_id]);
      const linkedUser = ures2?.rows?.[0] ?? null;
      if (linkedUser) {
        return { role: linkedUser.role || Roles.OWNER, user_id: linkedUser.id, resident_id: resident.id, unit_id: resident.unit_id, society_id: resident.society_id, name: resident.name || linkedUser.name || null, whatsapp_number: whatsappNumber };
      }
    }

    // Auto-create a users row so tickets get raised_by_user_id set properly
    const ins = await dbQuery(
      `INSERT INTO users (whatsapp_number, name, role, society_id)
       VALUES ($1, $2, 'OWNER', $3)
       ON CONFLICT (whatsapp_number) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [whatsappNumber, resident.name, resident.society_id],
    );
    const newUser = ins?.rows?.[0] ?? null;
    if (newUser) {
      await dbQuery("UPDATE residents SET user_id = $1 WHERE id = $2", [newUser.id, resident.id]);
      return { role: Roles.OWNER, user_id: newUser.id, resident_id: resident.id, unit_id: resident.unit_id, society_id: resident.society_id, name: resident.name || null, whatsapp_number: whatsappNumber };
    }

    // users insert failed — still allow interaction, just without a user_id
    return { role: Roles.OWNER, resident_id: resident.id, unit_id: resident.unit_id, society_id: resident.society_id, name: resident.name || null, whatsapp_number: whatsappNumber };
  }

  // Not found
  return { role: "UNREGISTERED", user: null, whatsapp_number: whatsappNumber };
}
