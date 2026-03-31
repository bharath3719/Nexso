import { dbQuery } from "../db/index.js";
import { TicketStatus, canTransition } from "../utils/stateMachine.js";
import { findVendorsFor, chooseVendor } from "./vendors.js";
import { notifyVendor } from "./notifications.js";

function nowIso() {
  return new Date().toISOString();
}

export async function createTicketIfNeeded(msg, identity) {
  const { society_id, user_id } = identity || {};
  const text = (msg?.text || msg?.raw_message_payload?.text?.body || msg?.raw_message_payload?.text || "").toLowerCase();
  const category = inferCategory(text);
  const description = msg?.text || msg?.raw_message_payload?.text?.body || msg?.raw_message_payload?.text || "No description";

  // Permission: must belong to a society
  if (!society_id || !user_id) {
    return { error: "permission_denied", reason: "User not registered in a society" };
  }

  const dedupMinutes = Number(process.env.DEDUP_MINUTES ?? 30);
  const shouldDedup = Number.isFinite(dedupMinutes) && dedupMinutes > 0;
  if (shouldDedup) {
    const dedup = await dbQuery(
      `SELECT * FROM tickets
       WHERE raised_by_user_id = $1
         AND category = $2
         AND created_at > NOW() - INTERVAL '${dedupMinutes} minutes'
         AND status != 'CLOSED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user_id, category],
    );
    if (dedup && dedup.rows && dedup.rows[0]) {
      return { deduplicated_ticket_id: dedup.rows[0].ticket_id };
    }
  }

  const ticketId = `T-${Date.now()}`;
  const ins = await dbQuery(
    `INSERT INTO tickets (ticket_id, society_id, raised_by_user_id, category, description, media_urls, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [ticketId, society_id, user_id, category, description, [], "NORMAL", TicketStatus.OPEN],
  );
  const ticket = ins && ins.rows ? ins.rows[0] : { ticket_id: ticketId, status: TicketStatus.OPEN };
  const autoAssign = String(process.env.AUTO_ASSIGN ?? "true").toLowerCase() === "true";

  let assignment = { assignment_status: "UNASSIGNED" };
  if (autoAssign) {
    const vendors = await findVendorsFor(society_id, category);
    const chosen = await chooseVendor(vendors);
    if (chosen && ticket?.id) {
      await dbQuery(`UPDATE tickets SET assigned_vendor_id = $1, status = $2, updated_at = NOW() WHERE id = $3`, [chosen.id, TicketStatus.ASSIGNED, ticket.id]);
      assignment = { assignment_status: "ASSIGNED", assigned_vendor_id: chosen.id };
      await notifyVendor(ticket, chosen);
    }
  }

  return { ticket_id: ticket.ticket_id, status: ticket.status, ...assignment };
}

export async function updateTicketIfNeeded(msg, identity) {
  const text = (msg?.text || msg?.raw_message_payload?.text?.body || msg?.raw_message_payload?.text || "").toLowerCase();
  const match = text.match(/ticket\s*#?\s*(t-\d+)/i);
  const ticketId = match ? match[1] : msg?.raw_message_payload?.ticket_id;
  if (!ticketId) return { error: "no_ticket_reference" };

  const res = await dbQuery("SELECT * FROM tickets WHERE ticket_id = $1", [ticketId]);
  const ticket = res && res.rows && res.rows[0] ? res.rows[0] : null;
  if (!ticket) return { error: "not_found" };

  const desired = inferDesiredStatus(text, ticket.status);
  const role = identity?.role || "UNKNOWN";
  if (!canTransition(ticket.status, desired, role)) {
    return { error: "invalid_transition", from: ticket.status, to: desired, role };
  }

  await dbQuery(`UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`, [desired, ticket.id]);
  await dbQuery(
    `INSERT INTO ticket_activity_logs (ticket_id, actor_role, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticket.id, role, ticket.status, desired, "Status updated via WhatsApp"],
  );
  return { ticket_id: ticket.ticket_id, status: desired };
}

function inferCategory(text) {
  if (text.includes("plumb")) return "PLUMBING";
  if (text.includes("elect")) return "ELECTRICAL";
  if (text.includes("security")) return "SECURITY";
  return "GENERAL";
}

function inferDesiredStatus(text, current) {
  if (/start|begin|arrive/.test(text)) return TicketStatus.IN_PROGRESS;
  if (/resolve|fixed|done/.test(text)) return TicketStatus.RESOLVED;
  if (/close|thank/.test(text)) return TicketStatus.CLOSED;
  // Default: keep current
  return current;
}
