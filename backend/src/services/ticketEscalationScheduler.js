/**
 * services/ticketEscalationScheduler.js
 *
 * Escalates NORMAL-priority OPEN tickets that have been sitting open for > 24h.
 * Runs every hour. Writes an activity-log entry for each escalated ticket.
 */

import cron from "node-cron";
import { dbQuery } from "../db/index.js";
import { log } from "../utils/logger.js";

async function escalateStaleTickets() {
  log("[TicketEscalation] Running priority escalation sweep…");

  try {
    // Fetch all OPEN + NORMAL tickets older than 24h that haven't been escalated yet
    const { rows: stale } = await dbQuery(
      `SELECT id, ticket_id
       FROM tickets
       WHERE status   = 'OPEN'
         AND priority = 'NORMAL'
         AND escalated_at IS NULL
         AND created_at < NOW() - INTERVAL '24 hours'`,
    );

    if (!stale.length) {
      log("[TicketEscalation] No tickets to escalate.");
      return;
    }

    const ids = stale.map((t) => t.id);

    // Bulk-update priority and stamp escalated_at
    await dbQuery(
      `UPDATE tickets
       SET priority     = 'HIGH',
           escalated_at = NOW(),
           updated_at   = NOW()
       WHERE id = ANY($1)`,
      [ids],
    );

    // Write one activity-log row per ticket so the history is visible in the UI
    for (const ticket of stale) {
      await dbQuery(
        `INSERT INTO ticket_activity_logs
           (ticket_id, actor_role, from_status, to_status, note, created_at)
         VALUES ($1, 'SYSTEM', 'OPEN', 'OPEN', 'Priority auto-escalated from NORMAL to HIGH (open > 24h)', NOW())`,
        [ticket.id],
      );
    }

    log(
      `[TicketEscalation] Escalated ${stale.length} ticket(s) to HIGH priority: ` +
        stale.map((t) => t.ticket_id).join(", "),
    );
  } catch (err) {
    log("[TicketEscalation] Error during escalation sweep:", err.message);
  }
}

export function startTicketEscalationScheduler() {
  const tz = process.env.CRON_TIMEZONE || "Asia/Kolkata";

  // Run every hour at :00
  cron.schedule("0 * * * *", () => {
    escalateStaleTickets();
  }, { timezone: tz });

  log("[TicketEscalation] Scheduler started — runs hourly, escalates OPEN NORMAL tickets older than 24h.");
}
