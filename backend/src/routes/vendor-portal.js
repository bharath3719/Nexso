/**
 * routes/vendor-portal.js
 * ────────────────────────
 * Vendor-scoped API. All endpoints require a valid JWT with
 * portal_role = 'VENDOR'. The vendor_id is taken from the token
 * so a vendor can never access another vendor's data.
 *
 *   GET   /api/vendor-portal/profile         — vendor info
 *   GET   /api/vendor-portal/stats           — dashboard stats
 *   GET   /api/vendor-portal/tickets         — assigned tickets (enriched)
 *   PATCH /api/vendor-portal/tickets/:id/status — update ticket status
 *   GET   /api/vendor-portal/notifications   — count of ASSIGNED (new) tickets
 */

import express from "express";
import { dbQuery } from "../db/index.js";
import { requireVendor } from "../middleware/auth.js";
import { sendWhatsAppText } from "../services/notifications.js";

const router = express.Router();

// All routes require VENDOR JWT
router.use(requireVendor);

// ── Allowed status transitions for vendors ────────────────────────────────────
// Vendor can only move: ASSIGNED → IN_PROGRESS → RESOLVED
const ALLOWED_TRANSITIONS = {
  ASSIGNED:    "IN_PROGRESS",
  IN_PROGRESS: "RESOLVED",
};

// ── GET /api/vendor-portal/profile ────────────────────────────────────────────

router.get("/profile", async (req, res) => {
  try {
    const vendorId = req.user.vendorId;
    const r = await dbQuery(
      `SELECT id, name, business_name, owner_name, phone, email, whatsapp_number,
              categories, active, verification_status, team_size,
              emergency_availability, gst, created_at
       FROM vendors WHERE id = $1`,
      [vendorId],
    );
    const vendor = r?.rows?.[0];
    if (!vendor) return res.status(404).json({ error: "vendor_not_found" });
    return res.json({ vendor, username: req.user.username });
  } catch (err) {
    console.error("Vendor profile error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/vendor-portal/stats ──────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const vendorId = req.user.vendorId;
    const r = await dbQuery(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'ASSIGNED')    AS assigned,
         COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
         COUNT(*) FILTER (WHERE status = 'RESOLVED')    AS resolved,
         COUNT(*) FILTER (WHERE status = 'CLOSED')      AS closed,
         COUNT(*) AS total
       FROM tickets
       WHERE assigned_vendor_id = $1`,
      [vendorId],
    );
    const row = r?.rows?.[0] || {};
    return res.json({
      assigned:    Number(row.assigned    || 0),
      inProgress:  Number(row.in_progress || 0),
      resolved:    Number(row.resolved    || 0),
      closed:      Number(row.closed      || 0),
      total:       Number(row.total       || 0),
    });
  } catch (err) {
    console.error("Vendor stats error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/vendor-portal/notifications ──────────────────────────────────────
// Returns count of newly-assigned tickets (status = ASSIGNED) — used for the
// notification bell badge.

router.get("/notifications", async (req, res) => {
  try {
    const vendorId = req.user.vendorId;
    const r = await dbQuery(
      `SELECT COUNT(*) AS count FROM tickets
       WHERE assigned_vendor_id = $1 AND status = 'ASSIGNED'`,
      [vendorId],
    );
    return res.json({ count: Number(r?.rows?.[0]?.count || 0) });
  } catch (err) {
    console.error("Vendor notifications error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/vendor-portal/tickets ────────────────────────────────────────────
// Returns all tickets assigned to this vendor, enriched with:
//   society_name, resident_whatsapp, resident_apartment,
//   resident_name, unit_number, floor_number, tower_name

router.get("/tickets", async (req, res) => {
  try {
    const vendorId = req.user.vendorId;
    const { status, limit = 100, offset = 0 } = req.query;

    const params = [vendorId];
    let where = "t.assigned_vendor_id = $1";
    if (status && status !== "ALL") {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }
    params.push(Number(limit), Number(offset));

    const q = `
      SELECT
        t.id,
        t.ticket_id,
        t.category,
        t.description,
        t.priority,
        t.status,
        t.media_urls,
        t.created_at,
        t.updated_at,
        t.society_id,
        s.name    AS society_name,
        u.whatsapp_number AS resident_whatsapp,
        u.apartment       AS resident_apartment,
        r.name            AS resident_name,
        un.unit_number,
        f.floor_number,
        tw.name           AS tower_name
      FROM tickets t
      LEFT JOIN societies s  ON s.id  = t.society_id
      LEFT JOIN users     u  ON u.id  = t.raised_by_user_id
      LEFT JOIN residents r  ON r.user_id = t.raised_by_user_id
      LEFT JOIN units     un ON un.id = r.unit_id
      LEFT JOIN floors    f  ON f.id  = un.floor_id
      LEFT JOIN towers    tw ON tw.id = f.tower_id
      WHERE ${where}
      ORDER BY
        CASE t.status
          WHEN 'ASSIGNED'    THEN 1
          WHEN 'IN_PROGRESS' THEN 2
          WHEN 'RESOLVED'    THEN 3
          WHEN 'CLOSED'      THEN 4
          ELSE 5
        END,
        t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const r = await dbQuery(q, params);
    return res.json({ tickets: r?.rows || [] });
  } catch (err) {
    console.error("Vendor list tickets error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/vendor-portal/tickets/:id/status ───────────────────────────────
// Vendor can only move: ASSIGNED → IN_PROGRESS → RESOLVED

router.patch("/tickets/:id/status", async (req, res) => {
  try {
    const vendorId = req.user.vendorId;
    const ticketId = Number(req.params.id);
    if (!ticketId || Number.isNaN(ticketId)) {
      return res.status(400).json({ error: "invalid_ticket_id" });
    }

    // Fetch the ticket (verify it belongs to this vendor)
    const existing = await dbQuery(
      `SELECT t.id, t.status, t.ticket_id, t.category,
              u.whatsapp_number AS raised_by_number,
              u.name            AS raised_by_name,
              v.name            AS vendor_name
       FROM tickets t
       LEFT JOIN users   u ON u.id = t.raised_by_user_id
       LEFT JOIN vendors v ON v.id = t.assigned_vendor_id
       WHERE t.id = $1 AND t.assigned_vendor_id = $2`,
      [ticketId, vendorId],
    );
    const ticket = existing?.rows?.[0];
    if (!ticket) return res.status(404).json({ error: "ticket_not_found" });

    const nextStatus = ALLOWED_TRANSITIONS[ticket.status];
    if (!nextStatus) {
      return res.status(400).json({
        error: "invalid_transition",
        message: `Cannot advance a ticket in '${ticket.status}' status.`,
      });
    }

    const updated = await dbQuery(
      `UPDATE tickets
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, ticket_id, status, updated_at`,
      [nextStatus, ticketId],
    );

    // Write activity log
    await dbQuery(
      `INSERT INTO ticket_activity_logs
         (ticket_id, actor_role, actor_vendor_id, from_status, to_status)
       VALUES ($1, 'VENDOR', $2, $3, $4)`,
      [ticketId, vendorId, ticket.status, nextStatus],
    ).catch(() => {});

    // Notify resident on meaningful status changes
    if (ticket.raised_by_number) {
      const ref = ticket.ticket_id || `#${ticket.id}`;
      const vendor = ticket.vendor_name || "our team";
      let msg;
      if (nextStatus === "IN_PROGRESS") {
        msg = `Update on your complaint ${ref}: ${vendor} has started working on it. We'll notify you once it's resolved.`;
      } else if (nextStatus === "RESOLVED") {
        msg = `Your complaint ${ref} has been marked as resolved by ${vendor}. If the issue persists, just message us again.`;
      }
      if (msg) sendWhatsAppText(ticket.raised_by_number, msg).catch(() => {});
    }

    return res.json({ ticket: updated?.rows?.[0] });
  } catch (err) {
    console.error("Vendor update ticket status error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
