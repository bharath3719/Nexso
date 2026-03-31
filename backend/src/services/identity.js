import { dbQuery } from "../db/index.js";
import { Roles } from "../utils/stateMachine.js";

export async function resolveIdentity(whatsappNumber) {
  if (!whatsappNumber) return { role: "UNKNOWN" };
  const res = await dbQuery("SELECT * FROM users WHERE whatsapp_number = $1", [whatsappNumber]);
  const user = res && res.rows && res.rows[0] ? res.rows[0] : null;
  if (!user) {
    return { role: "UNREGISTERED", user: null };
  }
  const role = user.role || Roles.OWNER;
  return { role, user_id: user.id, society_id: user.society_id };
}
