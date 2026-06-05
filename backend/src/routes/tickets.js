import express from "express";
import { dbQuery } from "../db/index.js";
import { TicketStatus, Roles, canTransition } from "../utils/stateMachine.js";
import { notifyVendor, sendWhatsAppText } from "../services/notifications.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAdmin);

// GET /api/tickets?status=&society_id=&category=&limit=50&offset=0
router.get("/", async (req, res) => {
  try {
    const status = req.query.status;
    const societyId = req.query.society_id ? Number(req.query.society_id) : undefined;
    const category = req.query.category;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const whereParts = [];
    const params = [];

    if (status) {
      params.push(status);
      whereParts.push(`t.status = $${params.length}`);
    }
    if (societyId) {
      params.push(societyId);
      whereParts.push(`t.society_id = $${params.length}`);
    }
    if (category) {
      params.push(category);
      whereParts.push(`t.category = $${params.length}`);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit);
    params.push(offset);

    const q = `
      SELECT
        t.*,
        t.assigned_vendor_id AS vendor_id,
        s.name AS society_name,
        v.name AS vendor_name,
        u.whatsapp_number AS raised_by_number,
        u.name AS raised_by_name,
        u.apartment AS raised_by_apartment
      FROM tickets t
      LEFT JOIN societies s ON s.id = t.society_id
      LEFT JOIN vendors v ON v.id = t.assigned_vendor_id
      LEFT JOIN users u ON u.id = t.raised_by_user_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const r = await dbQuery(q, params);
    return res.json({ tickets: r?.rows || [] });
  } catch (err) {
    console.error("List tickets error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/tickets/stats — lightweight open/unassigned counts for the nav badge
router.get("/stats", async (_req, res) => {
  try {
    const r = await dbQuery(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'OPEN')     AS open,
        COUNT(*) FILTER (WHERE status = 'ASSIGNED') AS assigned
      FROM tickets
    `);
    const row = r?.rows?.[0] || {};
    return res.json({ open: Number(row.open || 0), assigned: Number(row.assigned || 0) });
  } catch (err) {
    console.error("Ticket stats error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /api/tickets/:id — update status and/or assigned vendor
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_ticket_id" });

    const body = req.body || {};
    const { status, vendor_id } = body;
    const vendorProvided = Object.prototype.hasOwnProperty.call(body, "vendor_id");

    if (status && !Object.values(TicketStatus).includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    const vendorIdNormalized = vendorProvided ? (vendor_id === null || vendor_id === "" ? null : Number(vendor_id)) : undefined;
    if (vendorProvided && vendorIdNormalized !== null && !Number.isFinite(vendorIdNormalized)) {
      return res.status(400).json({ error: "invalid_vendor_id" });
    }

    const existing = await dbQuery("SELECT * FROM tickets WHERE id = $1", [id]);
    const ticket = existing?.rows?.[0];
    if (!ticket) return res.status(404).json({ error: "not_found" });

    if (status === undefined && !vendorProvided) {
      return res.status(400).json({ error: "no_fields" });
    }

    if (status && status !== ticket.status && !canTransition(ticket.status, status, Roles.SOCIETY_ADMIN)) {
      return res.status(400).json({ error: "invalid_transition", from: ticket.status, to: status });
    }

    const sets = [];
    const params = [];

    if (status) {
      params.push(status);
      sets.push(`status = $${params.length}`);
    }

    if (vendorProvided) {
      params.push(vendorIdNormalized);
      sets.push(`assigned_vendor_id = $${params.length}`);
    }

    params.push(id);
    const q = `UPDATE tickets SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`;
    const updatedRes = await dbQuery(q, params);
    const updatedTicket = updatedRes?.rows?.[0];

    if (status && status !== ticket.status) {
      await dbQuery(
        `INSERT INTO ticket_activity_logs (ticket_id, actor_role, from_status, to_status, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [ticket.id, Roles.SOCIETY_ADMIN, ticket.status, status, "Status updated via API"],
      );
    }

    const joined = await dbQuery(
      `SELECT
         t.*,
         t.assigned_vendor_id AS vendor_id,
         s.name AS society_name,
         v.name AS vendor_name,
         v.whatsapp_number AS vendor_whatsapp,
         u.whatsapp_number AS raised_by_number,
         u.name AS raised_by_name,
         u.apartment AS raised_by_apartment
       FROM tickets t
       LEFT JOIN societies s ON s.id = t.society_id
       LEFT JOIN vendors v ON v.id = t.assigned_vendor_id
       LEFT JOIN users u ON u.id = t.raised_by_user_id
       WHERE t.id = $1`,
      [id],
    );

    const fullTicket = joined?.rows?.[0] || updatedTicket;

    const newVendorId   = vendorIdNormalized ? Number(vendorIdNormalized) : null;
    const oldVendorId   = ticket.assigned_vendor_id ? Number(ticket.assigned_vendor_id) : null;
    const vendorChanged = vendorProvided && newVendorId && newVendorId !== oldVendorId;
    const statusChanged = status && status !== ticket.status;

    // Notify vendor when newly assigned
    if (vendorChanged && fullTicket?.vendor_whatsapp) {
      notifyVendor(fullTicket, { id: newVendorId, whatsapp_number: fullTicket.vendor_whatsapp }).catch(() => {});
    }

    // Notify resident
    if (fullTicket?.raised_by_number) {
      const ref      = fullTicket.ticket_id || `#${fullTicket.id}`;
      const vendor   = fullTicket.vendor_name || "our team";
      const category = (fullTicket.category || "complaint").toLowerCase();
      let msg;

      if (vendorChanged) {
        // Vendor assignment message covers the status change too
        msg = `Your ${category} complaint (${ref}) has been assigned to ${vendor}. They will attend to it shortly. We'll keep you updated.`;
      } else if (statusChanged) {
        const statusMessages = {
          ASSIGNED:    `Your ${category} complaint (${ref}) has been assigned to ${vendor}. They will attend to it shortly.`,
          IN_PROGRESS: `Update on your complaint (${ref}): ${vendor} has started working on it.`,
          RESOLVED:    `Your complaint (${ref}) has been resolved. If the issue persists, please message us again.`,
          CLOSED:      `Your complaint (${ref}) has been closed. Thank you.`,
        };
        msg = statusMessages[status];
      }

      if (msg) sendWhatsAppText(fullTicket.raised_by_number, msg).catch(() => {});
    }

    return res.json({ ticket: fullTicket });
  } catch (err) {
    console.error("Update ticket error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
