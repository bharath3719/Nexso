/**
 * routes/resident.js
 * ──────────────────
 * Resident-scoped API. All endpoints require a valid JWT with
 * portal_role = 'RESIDENT'. societyId, residentId, and unitId are
 * taken from the token — never trusted from the request body.
 *
 *   GET  /api/resident/announcements               — read society announcements
 *   GET  /api/resident/visitor-passes              — list own visitor passes
 *   POST /api/resident/visitor-passes              — create a visitor pass
 *   PATCH /api/resident/visitor-passes/:id/revoke  — revoke a pass
 *   GET  /api/resident/maintenance/dues            — list own dues
 *   GET  /api/resident/maintenance/invoice/:dueId/pdf — download bill PDF
 */

import express from "express";
import crypto  from "crypto";
import { dbQuery }        from "../db/index.js";
import { requireResident } from "../middleware/auth.js";
import {
  generateBillPdf, getOrCreateInvoiceNumber, computeBill,
} from "../services/billPdf.js";

const router = express.Router();

router.use(requireResident);

// ── GET /api/resident/profile ─────────────────────────────────────────────────

router.get("/profile", async (req, res) => {
  try {
    const { residentId } = req.user;

    const result = await dbQuery(
      `SELECT id, name, phone, email, preferred_contact, bhk, resident_type,
              family_members, vehicles, emergency_contact
       FROM residents WHERE id = $1`,
      [residentId],
    );

    const profile = result?.rows?.[0];
    if (!profile) return res.status(404).json({ error: "resident_not_found" });

    return res.json({ profile });
  } catch (err) {
    console.error("Resident profile GET error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/resident/profile ───────────────────────────────────────────────

router.patch("/profile", async (req, res) => {
  try {
    const { residentId } = req.user;
    const { email, preferred_contact, bhk, family_members, vehicles, emergency_contact } = req.body || {};

    const result = await dbQuery(
      `UPDATE residents
       SET email             = $1,
           preferred_contact = $2,
           bhk               = $3,
           family_members    = $4,
           vehicles          = $5::jsonb,
           emergency_contact = $6::jsonb
       WHERE id = $7
       RETURNING id, name, phone, email, preferred_contact, bhk, resident_type,
                 family_members, vehicles, emergency_contact`,
      [
        email     ?? null,
        preferred_contact ?? null,
        bhk       ?? null,
        family_members !== undefined ? Number(family_members) : null,
        JSON.stringify(vehicles ?? []),
        emergency_contact ? JSON.stringify(emergency_contact) : null,
        residentId,
      ],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "resident_not_found" });

    // Clear the first-login profile setup flag.
    await dbQuery(
      `UPDATE auth_accounts SET force_profile_setup = FALSE WHERE resident_id = $1`,
      [residentId],
    );

    return res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error("Resident profile PATCH error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/announcements ───────────────────────────────────────────

router.get("/announcements", async (req, res) => {
  try {
    const { societyId } = req.user;

    const result = await dbQuery(
      `SELECT id, title, body, category, priority, pinned, created_at
       FROM announcements
       WHERE society_id = $1
       ORDER BY pinned DESC, priority DESC, created_at DESC`,
      [societyId],
    );

    return res.json({ announcements: result?.rows || [] });
  } catch (err) {
    console.error("Resident announcements error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/visitor-passes ─────────────────────────────────────────

router.get("/visitor-passes", async (req, res) => {
  try {
    const { residentId, unitId, societyId } = req.user;
    const { status } = req.query;

    // Auto-expire passes whose valid_until has passed.
    await dbQuery(
      `UPDATE visitor_passes
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE unit_id = $1 AND status = 'ACTIVE' AND valid_until < NOW()`,
      [unitId],
    );

    let sql = `
      SELECT * FROM visitor_passes
      WHERE unit_id = $1 AND society_id = $2`;
    const params = [unitId, societyId];

    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await dbQuery(sql, params);
    return res.json({ passes: result?.rows || [] });
  } catch (err) {
    console.error("List visitor passes error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/resident/visitor-passes ────────────────────────────────────────

router.post("/visitor-passes", async (req, res) => {
  try {
    const { residentId, unitId, societyId } = req.user;
    const { visitor_name, visitor_phone, purpose, valid_from, valid_until, vehicle } = req.body || {};

    if (!visitor_name?.trim()) {
      return res.status(400).json({ error: "visitor_name_required" });
    }
    if (!valid_from || !valid_until) {
      return res.status(400).json({ error: "validity_window_required" });
    }

    const from = new Date(valid_from);
    const until = new Date(valid_until);

    if (isNaN(from) || isNaN(until)) {
      return res.status(400).json({ error: "invalid_dates" });
    }
    if (until <= from) {
      return res.status(400).json({ error: "valid_until_must_be_after_valid_from" });
    }

    const passCode = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

    const result = await dbQuery(
      `INSERT INTO visitor_passes
         (unit_id, society_id, resident_id, visitor_name, visitor_phone,
          purpose, valid_from, valid_until, vehicle, pass_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [unitId, societyId, residentId,
       visitor_name.trim(), visitor_phone?.trim() || null,
       purpose?.trim() || null, from, until,
       vehicle?.trim() || null, passCode],
    );

    return res.status(201).json({ pass: result.rows[0] });
  } catch (err) {
    console.error("Create visitor pass error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/resident/visitor-passes/:id/revoke ────────────────────────────

router.patch("/visitor-passes/:id/revoke", async (req, res) => {
  try {
    const { unitId, societyId } = req.user;
    const { id } = req.params;

    const result = await dbQuery(
      `UPDATE visitor_passes
       SET status = 'REVOKED', updated_at = NOW()
       WHERE id = $1 AND unit_id = $2 AND society_id = $3
         AND status IN ('ACTIVE')
       RETURNING *`,
      [id, unitId, societyId],
    );

    if (!result?.rows?.length) {
      return res.status(404).json({ error: "pass_not_found_or_not_revocable" });
    }

    return res.json({ pass: result.rows[0] });
  } catch (err) {
    console.error("Revoke visitor pass error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/maintenance/dues ───────────────────────────────────────
// Returns dues for the logged-in resident.
// ?type=pending → PENDING + OVERDUE only; ?type=history → PAID + WAIVED only.

router.get("/maintenance/dues", async (req, res) => {
  try {
    const { residentId, societyId } = req.user;
    const { type } = req.query;

    // PENDING_VERIFICATION counts as unsettled — the resident has paid but the
    // society hasn't confirmed it yet, so it belongs with the pending dues.
    let statuses;
    if (type === "pending")  statuses = ["PENDING", "OVERDUE", "PENDING_VERIFICATION"];
    else if (type === "history") statuses = ["PAID", "WAIVED"];
    else statuses = ["PENDING", "OVERDUE", "PENDING_VERIFICATION", "PAID", "WAIVED"];

    const result = await dbQuery(
      `SELECT md.id, md.due_month, md.amount, md.due_date, md.status,
              md.payment_reference, md.payment_date, md.payment_link,
              md.claimed_utr, md.claimed_at,
              md.base_amount, md.expense_share, md.previously_due,
              md.interest_amount, md.breakdown,
              mi.invoice_number
       FROM maintenance_dues md
       LEFT JOIN maintenance_invoices mi ON mi.due_id = md.id
       WHERE md.resident_id = $1 AND md.society_id = $2
         AND md.status = ANY($3::text[])
       ORDER BY md.due_date DESC`,
      [residentId, societyId, statuses],
    );

    return res.json({ dues: result?.rows || [] });
  } catch (err) {
    console.error("Resident dues list error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/maintenance/invoice/:dueId/pdf ─────────────────────────
// Downloads the bill PDF for a specific due that belongs to this resident.

router.get("/maintenance/invoice/:dueId/pdf", async (req, res) => {
  try {
    const { residentId, societyId } = req.user;
    const { dueId } = req.params;

    const [dueRes, socRes] = await Promise.all([
      dbQuery(
        `SELECT md.*, r.name AS resident_name, u.unit_number,
                COALESCE(td.name, tf.name) AS tower_name,
                r.phone AS resident_phone
         FROM maintenance_dues md
         JOIN residents r ON r.id = md.resident_id
         JOIN units u ON u.id = r.unit_id
         LEFT JOIN towers td ON td.id = u.tower_id
         LEFT JOIN floors f  ON f.id  = u.floor_id
         LEFT JOIN towers tf ON tf.id = f.tower_id
         WHERE md.id = $1 AND md.resident_id = $2 AND md.society_id = $3`,
        [dueId, residentId, societyId],
      ),
      dbQuery(
        `SELECT name, address, maintenance_upi_id, code FROM societies WHERE id = $1`,
        [societyId],
      ),
    ]);

    if (!dueRes?.rows?.length) return res.status(404).json({ error: "due_not_found" });

    const due     = dueRes.rows[0];
    const society = socRes.rows[0] || {};

    const invoiceNumber = await getOrCreateInvoiceNumber(dueId, societyId, society.code);

    let bill;
    if (due.breakdown && due.base_amount !== null) {
      const bd = typeof due.breakdown === "string" ? JSON.parse(due.breakdown) : due.breakdown;
      const unitCount = bd.unit_count || 1;
      const toPerUnit = (items) => (items || []).map((item) => ({
        particulars:  item.particulars,
        total_amount: Number(item.total_amount || 0),
        per_unit:     Math.round((Number(item.total_amount || 0) / unitCount) * 100) / 100,
      }));

      bill = {
        society:         { name: society.name || "", address: society.address || "" },
        resident:        {
          name:        due.resident_name,
          unit_number: due.tower_name ? `${due.tower_name} · ${due.unit_number}` : due.unit_number,
        },
        month:           due.due_month,
        fixed_items:     toPerUnit(bd.fixed_items),
        variable_items:  toPerUnit(bd.variable_items),
        fixed_total:     (bd.fixed_items || []).reduce((s, i) => s + Number(i.total_amount || 0) / unitCount, 0),
        variable_total:  (bd.variable_items || []).reduce((s, i) => s + Number(i.total_amount || 0) / unitCount, 0),
        base_amount:     Number(due.base_amount || 0),
        expense_share:   Number(due.expense_share || 0),
        previously_due:  Number(due.previously_due || 0),
        interest_rate:   21,
        interest_amount: Number(due.interest_amount || 0),
        total:           Number(due.amount || 0),
        unit_count:      unitCount,
      };
    } else {
      bill = await computeBill(societyId, residentId, due.due_month);
    }

    const buffer = await generateBillPdf(
      bill,
      due.payment_link || null,
      society.maintenance_upi_id || null,
      invoiceNumber,
    );

    const filename = `invoice-${invoiceNumber.replace(/\//g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Resident invoice PDF error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/events ─────────────────────────────────────────────────

router.get("/events", async (req, res) => {
  try {
    const { residentId, societyId } = req.user;

    const result = await dbQuery(
      `SELECT e.*,
              COUNT(r2.id) FILTER (WHERE r2.response = 'YES')   AS rsvp_yes,
              COUNT(r2.id) FILTER (WHERE r2.response = 'NO')    AS rsvp_no,
              COUNT(r2.id) FILTER (WHERE r2.response = 'MAYBE') AS rsvp_maybe,
              my.response AS my_response
       FROM society_events e
       LEFT JOIN event_rsvps r2 ON r2.event_id = e.id
       LEFT JOIN event_rsvps my ON my.event_id = e.id AND my.resident_id = $2
       WHERE e.society_id = $1
       GROUP BY e.id, my.response
       ORDER BY e.event_date ASC`,
      [societyId, residentId],
    );
    return res.json({ events: result?.rows || [] });
  } catch (err) {
    console.error("Resident list events error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/resident/events/:id/rsvp ───────────────────────────────────────

router.post("/events/:id/rsvp", async (req, res) => {
  try {
    const { residentId, societyId } = req.user;
    const { response } = req.body || {};

    const valid = ["YES", "NO", "MAYBE"];
    if (!valid.includes(response)) return res.status(400).json({ error: "invalid_response" });

    const eventRes = await dbQuery(
      `SELECT id FROM society_events WHERE id = $1 AND society_id = $2`,
      [req.params.id, societyId],
    );
    if (!eventRes?.rows?.length) return res.status(404).json({ error: "event_not_found" });

    await dbQuery(
      `INSERT INTO event_rsvps (event_id, resident_id, society_id, response)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, resident_id)
       DO UPDATE SET response = EXCLUDED.response, updated_at = NOW()`,
      [req.params.id, residentId, societyId, response],
    );
    return res.json({ success: true, response });
  } catch (err) {
    console.error("Resident RSVP error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/polls ───────────────────────────────────────────────────

router.get("/polls", async (req, res) => {
  try {
    const { residentId, societyId } = req.user;

    const result = await dbQuery(
      `SELECT p.*,
              COUNT(v.id)        AS total_votes,
              my.option_index    AS my_vote,
              CASE WHEN p.closes_at IS NULL OR p.closes_at > NOW() THEN true ELSE false END AS is_open
       FROM polls p
       LEFT JOIN poll_votes v  ON v.poll_id = p.id
       LEFT JOIN poll_votes my ON my.poll_id = p.id AND my.resident_id = $2
       WHERE p.society_id = $1
       GROUP BY p.id, my.option_index
       ORDER BY p.created_at DESC`,
      [societyId, residentId],
    );
    return res.json({ polls: result?.rows || [] });
  } catch (err) {
    console.error("Resident list polls error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/resident/polls/:id/vote ────────────────────────────────────────

router.post("/polls/:id/vote", async (req, res) => {
  try {
    const { residentId, societyId } = req.user;
    const { option_index } = req.body || {};

    if (typeof option_index !== "number" && typeof option_index !== "string") {
      return res.status(400).json({ error: "option_index_required" });
    }
    const idx = Number(option_index);
    if (!Number.isFinite(idx) || idx < 0) return res.status(400).json({ error: "invalid_option_index" });

    const pollRes = await dbQuery(
      `SELECT * FROM polls WHERE id = $1 AND society_id = $2`,
      [req.params.id, societyId],
    );
    if (!pollRes?.rows?.length) return res.status(404).json({ error: "poll_not_found" });
    const poll = pollRes.rows[0];

    if (poll.closes_at && new Date(poll.closes_at) < new Date()) {
      return res.status(400).json({ error: "poll_closed" });
    }
    if (idx >= (poll.options || []).length) {
      return res.status(400).json({ error: "invalid_option_index" });
    }

    await dbQuery(
      `INSERT INTO poll_votes (poll_id, resident_id, society_id, option_index)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (poll_id, resident_id)
       DO UPDATE SET option_index = EXCLUDED.option_index`,
      [req.params.id, residentId, societyId, idx],
    );
    return res.json({ success: true, option_index: idx });
  } catch (err) {
    console.error("Resident poll vote error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/complaints/:id ─────────────────────────────────────────

router.get("/complaints/:id", async (req, res) => {
  try {
    const { unitId, societyId } = req.user;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

    const [ticketRes, logsRes] = await Promise.all([
      dbQuery(
        `SELECT t.id, t.ticket_id, t.category, t.description, t.priority,
                t.status, t.created_at, t.updated_at,
                v.business_name AS vendor_name
         FROM tickets t
         LEFT JOIN vendors v ON v.id = t.assigned_vendor_id
         WHERE t.id = $1 AND t.society_id = $2 AND t.unit_id = $3`,
        [id, societyId, unitId],
      ),
      dbQuery(
        `SELECT actor_role, from_status, to_status, note, created_at
         FROM ticket_activity_logs
         WHERE ticket_id = $1
         ORDER BY created_at ASC`,
        [id],
      ),
    ]);

    if (!ticketRes?.rows?.length) return res.status(404).json({ error: "complaint_not_found" });

    return res.json({ complaint: ticketRes.rows[0], activity: logsRes?.rows || [] });
  } catch (err) {
    console.error("Resident complaint detail error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/resident/complaints ─────────────────────────────────────────────

router.get("/complaints", async (req, res) => {
  try {
    const { unitId, societyId } = req.user;

    const result = await dbQuery(
      `SELECT t.id, t.ticket_id, t.category, t.description, t.priority,
              t.status, t.created_at, t.updated_at,
              v.business_name AS vendor_name
       FROM tickets t
       LEFT JOIN vendors v ON v.id = t.assigned_vendor_id
       WHERE t.society_id = $1 AND t.unit_id = $2
       ORDER BY t.created_at DESC`,
      [societyId, unitId],
    );

    return res.json({ complaints: result?.rows || [] });
  } catch (err) {
    console.error("Resident complaints list error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/resident/complaints ────────────────────────────────────────────

router.post("/complaints", async (req, res) => {
  try {
    const { unitId, societyId } = req.user;
    const { category, description, priority } = req.body || {};

    if (!category?.trim()) return res.status(400).json({ error: "category_required" });
    if (!description?.trim()) return res.status(400).json({ error: "description_required" });

    const ticketPriority = priority === "URGENT" ? "URGENT" : "NORMAL";
    const ticketId = `T-${Date.now()}`;

    const result = await dbQuery(
      `INSERT INTO tickets
         (ticket_id, society_id, unit_id, category, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
       RETURNING id, ticket_id, category, description, priority, status, created_at`,
      [ticketId, societyId, unitId, category.trim(), description.trim(), ticketPriority],
    );

    return res.status(201).json({ complaint: result.rows[0] });
  } catch (err) {
    console.error("Resident complaint create error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
