/**
 * routes/secretary.js
 * ────────────────────
 * Secretary-scoped API. All endpoints require a valid JWT with
 * portal_role = 'SOCIETY_ADMIN'. The society_id is taken from the token
 * (never from the URL) so a secretary can never access another society's data.
 *
 *   GET    /api/secretary/society            — society overview
 *   GET    /api/secretary/residents          — list all residents
 *   POST   /api/secretary/residents          — add a single resident
 *   PATCH  /api/secretary/residents/:id      — edit a resident
 *   DELETE /api/secretary/residents/:id      — remove a resident
 *   GET    /api/secretary/tickets            — tickets for this society
 *   GET    /api/secretary/stats              — quick stats for dashboard
 */

import express from "express";
import { dbQuery } from "../db/index.js";
import { requireSecretary } from "../middleware/auth.js";
import { sendWhatsAppText } from "../services/notifications.js";
import { sendMaintenanceReminderEmail, isEmailConfigured } from "../services/email.js";
import { createDuePaymentLink, activeProvider, isPaymentConfigured } from "../services/paymentLinks.js";
import { isValidVpa } from "../services/upiService.js";
import {
  generateBillPdf, generateCollectionRegisterPdf, generateClosurePdf,
  getOrCreateInvoiceNumber, computeBill,
} from "../services/billPdf.js";

const router = express.Router();

// All routes require SOCIETY_ADMIN JWT
router.use(requireSecretary);

// ── GET /api/secretary/society ────────────────────────────────────────────────

router.get("/society", async (req, res) => {
  try {
    const societyId = req.user.societyId;

    const socResult = await dbQuery(
      `SELECT s.*,
              COALESCE(u.unit_count,     0) AS unit_count,
              COALESCE(r.resident_count, 0) AS resident_count,
              COALESCE(t.tower_count,    0) AS tower_count
       FROM societies s
       LEFT JOIN (SELECT society_id, COUNT(*) AS unit_count     FROM units    GROUP BY society_id) u ON u.society_id = s.id
       LEFT JOIN (SELECT society_id, COUNT(*) AS resident_count FROM residents GROUP BY society_id) r ON r.society_id = s.id
       LEFT JOIN (SELECT society_id, COUNT(*) AS tower_count    FROM towers   GROUP BY society_id) t ON t.society_id = s.id
       WHERE s.id = $1`,
      [societyId],
    );

    if (!socResult?.rows?.length) return res.status(404).json({ error: "society_not_found" });

    return res.json({ society: socResult.rows[0] });
  } catch (err) {
    console.error("Secretary society error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/stats ──────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const societyId = req.user.societyId;

    const [residents, tickets, units] = await Promise.all([
      dbQuery(`SELECT COUNT(*) AS total,
                      COUNT(*) FILTER (WHERE invitation_status = 'PENDING') AS pending_invites
               FROM residents WHERE society_id = $1`, [societyId]),
      dbQuery(`SELECT COUNT(*) AS total,
                      COUNT(*) FILTER (WHERE status = 'OPEN')        AS open,
                      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
                      COUNT(*) FILTER (WHERE status = 'RESOLVED')    AS resolved
               FROM tickets WHERE society_id = $1`, [societyId]),
      dbQuery(`SELECT COUNT(*) AS total FROM units WHERE society_id = $1`, [societyId]),
    ]);

    const rRow = residents?.rows?.[0] || {};
    const tRow = tickets?.rows?.[0]   || {};
    const uRow = units?.rows?.[0]     || {};

    return res.json({
      residents: {
        total:          Number(rRow.total          || 0),
        pendingInvites: Number(rRow.pending_invites || 0),
      },
      units: { total: Number(uRow.total || 0) },
      tickets: {
        total:      Number(tRow.total       || 0),
        open:       Number(tRow.open        || 0),
        inProgress: Number(tRow.in_progress || 0),
        resolved:   Number(tRow.resolved    || 0),
      },
    });
  } catch (err) {
    console.error("Secretary stats error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/residents ─────────────────────────────────────────────

router.get("/residents", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { search } = req.query;

    let sql = `
      SELECT r.*, u.unit_number, t.name AS tower_name,
             ms.enabled         AS maintenance_enabled,
             ms.amount          AS maintenance_amount,
             ms.due_day         AS maintenance_due_day,
             ms.bill_recipient  AS maintenance_bill_recipient
      FROM residents r
      JOIN units  u ON u.id = r.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN maintenance_settings ms ON ms.unit_id = r.unit_id
      WHERE r.society_id = $1`;
    const params = [societyId];

    if (search?.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(r.name) LIKE $${params.length}
                OR LOWER(u.unit_number) LIKE $${params.length}
                OR LOWER(r.phone) LIKE $${params.length})`;
    }

    sql += ` ORDER BY t.name NULLS LAST, u.unit_number, r.name`;

    const result = await dbQuery(sql, params);
    return res.json({ residents: result?.rows || [] });
  } catch (err) {
    console.error("Secretary list residents error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/structure ─────────────────────────────────────────────
// Full tower → floor → unit tree plus lightweight resident placement data
// (tower_idx, unit_number, name, phone) consumed by StructurePreviewModal.

router.get("/structure", async (req, res) => {
  try {
    const societyId = req.user.societyId;

    // 1. Towers ordered by name
    const towersResult = await dbQuery(
      "SELECT id, name FROM towers WHERE society_id = $1 ORDER BY name",
      [societyId],
    );
    const towers = towersResult?.rows || [];

    // Build tower-id → array-index map (needed for resident placement)
    const towerIdxMap = {};
    towers.forEach((t, i) => { towerIdxMap[t.id] = i; });

    // 2. Floors + unit lists per tower
    // unitMap: "TowerName:unit_number" → unit DB id — used by the frontend to
    // pre-fill the Add Resident form when the user clicks an empty unit chip.
    const unitMap = {};

    for (const tower of towers) {
      const floorsResult = await dbQuery(
        "SELECT id, floor_number FROM floors WHERE tower_id = $1 ORDER BY floor_number",
        [tower.id],
      );
      tower.floors = floorsResult?.rows || [];

      for (const floor of tower.floors) {
        const unitsResult = await dbQuery(
          "SELECT id, unit_number FROM units WHERE floor_id = $1 ORDER BY unit_number",
          [floor.id],
        );
        floor.units = (unitsResult?.rows || []).map((u) => {
          unitMap[`${tower.name}:${u.unit_number}`] = u.id;
          return u.unit_number;
        });
      }
    }

    // 3. Residents — minimal fields for coverage overlay
    const residentsResult = await dbQuery(
      `SELECT r.id, r.name, r.phone, u.unit_number, u.tower_id
       FROM residents r
       JOIN units u ON u.id = r.unit_id
       WHERE r.society_id = $1`,
      [societyId],
    );

    const residents = (residentsResult?.rows || []).map((r) => ({
      id:          r.id,
      name:        r.name,
      phone:       r.phone,
      unit_number: r.unit_number,
      tower_idx:   towerIdxMap[r.tower_id] ?? 0,
    }));

    return res.json({ towers, residents, unitMap });
  } catch (err) {
    console.error("Secretary structure error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/units ──────────────────────────────────────────────────
// Used by the Add Resident modal to populate the unit dropdown

router.get("/units", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    // COALESCE over two join paths so tower_name is never null:
    //   1. direct u.tower_id  (primary, set during onboarding)
    //   2. u.floor_id → floor.tower_id  (fallback for legacy rows)
    const result = await dbQuery(
      `SELECT u.id, u.unit_number,
              COALESCE(td.name, tf.name) AS tower_name
       FROM units u
       LEFT JOIN towers  td ON td.id = u.tower_id
       LEFT JOIN floors  f  ON f.id  = u.floor_id
       LEFT JOIN towers  tf ON tf.id = f.tower_id
       WHERE u.society_id = $1
       ORDER BY COALESCE(td.name, tf.name) NULLS LAST, u.unit_number`,
      [societyId],
    );
    return res.json({ units: result?.rows || [] });
  } catch (err) {
    console.error("Secretary list units error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/residents ─────────────────────────────────────────────

router.post("/residents", async (req, res) => {
  const societyId = req.user.societyId;
  const {
    unit_id,
    name,
    phone,
    email,
    aadhar_number,
    preferred_contact = "WHATSAPP",
    bhk,
    resident_type = "OWNER",
    family_members = 0,
    // Maintenance
    maintenance_enabled = false,
    maintenance_amount,
    maintenance_due_day,
    maintenance_bill_recipient,
  } = req.body || {};

  if (!name?.trim())    return res.status(400).json({ error: "name_required" });
  if (!unit_id)         return res.status(400).json({ error: "unit_required" });

  try {
    // Verify unit belongs to this secretary's society — also fetch tower_name
    // so the response can render "Tower B · 201" in the table immediately.
    const unitCheck = await dbQuery(
      `SELECT u.id, u.unit_number, COALESCE(td.name, tf.name) AS tower_name
       FROM units u
       LEFT JOIN towers  td ON td.id = u.tower_id
       LEFT JOIN floors  f  ON f.id  = u.floor_id
       LEFT JOIN towers  tf ON tf.id = f.tower_id
       WHERE u.id = $1 AND u.society_id = $2`,
      [unit_id, societyId],
    );
    if (!unitCheck?.rows?.length) return res.status(404).json({ error: "unit_not_found" });

    // One OWNER + one TENANT per unit
    const normalizedType = (resident_type || "OWNER").toUpperCase();
    if (!["OWNER", "TENANT"].includes(normalizedType)) {
      return res.status(400).json({ error: "invalid_resident_type", message: "resident_type must be OWNER or TENANT." });
    }
    const typeLabel = normalizedType === "OWNER" ? "Owner" : "Tenant";
    const occupancyCheck = await dbQuery(
      `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 LIMIT 1`,
      [unit_id, normalizedType],
    );
    if (occupancyCheck?.rows?.length) {
      return res.status(409).json({
        error: "occupancy_conflict",
        message: `This unit already has an ${typeLabel}. Remove the existing ${typeLabel} before adding a new one.`,
      });
    }

    const result = await dbQuery(
      `INSERT INTO residents
         (unit_id, society_id, name, phone, email, aadhar_number,
          preferred_contact, bhk, resident_type, family_members, invitation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')
       RETURNING *`,
      [
        unit_id,
        societyId,
        name.trim(),
        phone || null,
        email || null,
        aadhar_number || null,
        preferred_contact,
        bhk || null,
        normalizedType,
        Number(family_members) || 0,
      ],
    );

    const resident = result.rows[0];

    // Upsert maintenance settings per unit (not per resident)
    if (maintenance_enabled || maintenance_amount || maintenance_due_day || maintenance_bill_recipient) {
      const mEnabled    = !!maintenance_enabled;
      const mAmount     = maintenance_amount     ? Number(maintenance_amount)  : null;
      const mDay        = maintenance_due_day    ? Number(maintenance_due_day) : null;
      const mRecipient  = ["OWNER", "TENANT"].includes(maintenance_bill_recipient)
        ? maintenance_bill_recipient : "OWNER";

      const msEx = await dbQuery(`SELECT id FROM maintenance_settings WHERE unit_id = $1`, [unit_id]);
      if (msEx?.rows?.length) {
        await dbQuery(
          `UPDATE maintenance_settings SET enabled = $1, amount = $2, due_day = $3, bill_recipient = $4, updated_at = NOW() WHERE unit_id = $5`,
          [mEnabled, mAmount, mDay, mRecipient, unit_id],
        );
      } else {
        await dbQuery(
          `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day, bill_recipient) VALUES ($1, $2, $3, $4, $5, $6)`,
          [unit_id, societyId, mEnabled, mAmount, mDay, mRecipient],
        );
      }
    }

    // Read back unit-level maintenance settings for the response
    const msRes = await dbQuery(
      `SELECT enabled AS maintenance_enabled, amount AS maintenance_amount,
              due_day AS maintenance_due_day, bill_recipient AS maintenance_bill_recipient
       FROM maintenance_settings WHERE unit_id = $1`,
      [unit_id],
    );
    const ms = msRes?.rows?.[0] || {};

    return res.status(201).json({
      resident: {
        ...resident,
        unit_number:                   unitCheck.rows[0].unit_number,
        tower_name:                    unitCheck.rows[0].tower_name  || null,
        maintenance_enabled:           ms.maintenance_enabled           ?? false,
        maintenance_amount:            ms.maintenance_amount            ?? null,
        maintenance_due_day:           ms.maintenance_due_day           ?? null,
        maintenance_bill_recipient:    ms.maintenance_bill_recipient    ?? "OWNER",
      },
    });
  } catch (err) {
    console.error("Secretary add resident error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/secretary/residents/:id ───────────────────────────────────────

router.patch("/residents/:id", async (req, res) => {
  const societyId  = req.user.societyId;
  const residentId = req.params.id;
  const {
    name, phone, email, aadhar_number,
    preferred_contact, bhk, resident_type, family_members,
    // Maintenance
    maintenance_enabled,
    maintenance_amount,
    maintenance_due_day,
    maintenance_bill_recipient,
  } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: "name_required" });

  try {
    // Fetch current resident first to get unit_id for conflict check
    const currentRes = await dbQuery(
      `SELECT id, unit_id FROM residents WHERE id = $1 AND society_id = $2`,
      [residentId, societyId],
    );
    if (!currentRes?.rows?.length) return res.status(404).json({ error: "not_found" });
    const unitId = currentRes.rows[0].unit_id;

    // Check occupancy conflict BEFORE updating to return 409 instead of DB constraint error
    if (unitId) {
      const effectiveType  = (resident_type || "OWNER").toUpperCase();
      if (!["OWNER", "TENANT"].includes(effectiveType)) {
        return res.status(400).json({ error: "invalid_resident_type", message: "resident_type must be OWNER or TENANT." });
      }
      const effectiveLabel = effectiveType === "OWNER" ? "Owner" : "Tenant";
      const conflict = await dbQuery(
        `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 AND id <> $3 LIMIT 1`,
        [unitId, effectiveType, residentId],
      );
      if (conflict?.rows?.length) {
        return res.status(409).json({
          error: "occupancy_conflict",
          message: `This unit already has an ${effectiveLabel}. Remove the existing ${effectiveLabel} before reassigning.`,
        });
      }
    }

    const result = await dbQuery(
      `UPDATE residents SET
         name              = $1,
         phone             = $2,
         email             = $3,
         aadhar_number     = $4,
         preferred_contact = $5,
         bhk               = $6,
         resident_type     = $7,
         family_members    = $8
       WHERE id = $9 AND society_id = $10
       RETURNING *`,
      [
        name.trim(),
        phone    || null,
        email    || null,
        aadhar_number || null,
        preferred_contact || "WHATSAPP",
        bhk      || null,
        resident_type || "OWNER",
        Number(family_members) || 0,
        residentId,
        societyId,
      ],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });

    const resident = result.rows[0];

    const unitRes = await dbQuery(
      `SELECT u.unit_number, COALESCE(td.name, tf.name) AS tower_name
       FROM units u
       LEFT JOIN towers  td ON td.id = u.tower_id
       LEFT JOIN floors  f  ON f.id  = u.floor_id
       LEFT JOIN towers  tf ON tf.id = f.tower_id
       WHERE u.id = $1`,
      [resident.unit_id],
    );

    // Upsert unit-level maintenance settings when any field is explicitly sent
    if (
      resident.unit_id !== null &&
      (maintenance_enabled !== undefined || maintenance_amount !== undefined ||
       maintenance_due_day !== undefined || maintenance_bill_recipient !== undefined)
    ) {
      const mEnabled   = !!maintenance_enabled;
      const mAmount    = maintenance_amount  ? Number(maintenance_amount)  : null;
      const mDay       = maintenance_due_day ? Number(maintenance_due_day) : null;
      const mRecipient = ["OWNER", "TENANT"].includes(maintenance_bill_recipient)
        ? maintenance_bill_recipient : "OWNER";

      const msExisting = await dbQuery(
        `SELECT id FROM maintenance_settings WHERE unit_id = $1`,
        [resident.unit_id],
      );
      if (msExisting?.rows?.length) {
        await dbQuery(
          `UPDATE maintenance_settings SET enabled = $1, amount = $2, due_day = $3, bill_recipient = $4, updated_at = NOW() WHERE unit_id = $5`,
          [mEnabled, mAmount, mDay, mRecipient, resident.unit_id],
        );
      } else {
        await dbQuery(
          `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day, bill_recipient) VALUES ($1, $2, $3, $4, $5, $6)`,
          [resident.unit_id, societyId, mEnabled, mAmount, mDay, mRecipient],
        );
      }
    }

    // Fetch the current unit-level maintenance settings
    const msRes = await dbQuery(
      `SELECT enabled AS maintenance_enabled, amount AS maintenance_amount,
              due_day AS maintenance_due_day, bill_recipient AS maintenance_bill_recipient
       FROM maintenance_settings WHERE unit_id = $1`,
      [resident.unit_id],
    );
    const ms = msRes?.rows?.[0] || {};

    return res.json({
      resident: {
        ...resident,
        unit_number:                unitRes.rows[0]?.unit_number,
        tower_name:                 unitRes.rows[0]?.tower_name || null,
        maintenance_enabled:        ms.maintenance_enabled        ?? false,
        maintenance_amount:         ms.maintenance_amount         ?? null,
        maintenance_due_day:        ms.maintenance_due_day        ?? null,
        maintenance_bill_recipient: ms.maintenance_bill_recipient ?? "OWNER",
      },
    });
  } catch (err) {
    console.error("Secretary update resident error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/secretary/residents/:id ──────────────────────────────────────

router.delete("/residents/:id", async (req, res) => {
  const societyId  = req.user.societyId;
  const residentId = req.params.id;

  try {
    const result = await dbQuery(
      `DELETE FROM residents WHERE id = $1 AND society_id = $2 RETURNING id`,
      [residentId, societyId],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Secretary delete resident error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/tickets ────────────────────────────────────────────────

router.get("/tickets", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT t.*,
             u.name AS raised_by_name,
             v.name AS vendor_name
      FROM tickets t
      LEFT JOIN users   u ON u.id = t.raised_by_user_id
      LEFT JOIN vendors v ON v.id = t.assigned_vendor_id
      WHERE t.society_id = $1`;
    const params = [societyId];

    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await dbQuery(sql, params);
    return res.json({ tickets: result?.rows || [] });
  } catch (err) {
    console.error("Secretary list tickets error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance ────────────────────────────────────────────
// Lists dues for the secretary's society for a given month.

router.get("/maintenance", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month, status } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let sql = `
      SELECT
        md.*,
        r.name                          AS resident_name,
        r.phone                         AS resident_phone,
        u.unit_number,
        COALESCE(td.name, tf.name)      AS tower_name
      FROM maintenance_dues md
      JOIN residents r ON r.id  = md.resident_id
      JOIN units     u ON u.id  = r.unit_id
      LEFT JOIN towers td ON td.id = u.tower_id
      LEFT JOIN floors f  ON f.id  = u.floor_id
      LEFT JOIN towers tf ON tf.id = f.tower_id
      WHERE md.society_id = $1 AND md.due_month = $2`;
    const params = [societyId, targetMonth];

    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND md.status = $${params.length}`;
    }

    sql += ` ORDER BY COALESCE(td.name, tf.name) NULLS LAST, u.unit_number, r.name`;

    const result = await dbQuery(sql, params);
    const dues   = result?.rows || [];

    const stats = {
      total:           dues.length,
      paid:            dues.filter((d) => d.status === "PAID").length,
      pending:         dues.filter((d) => d.status === "PENDING").length,
      pendingVerification: dues.filter((d) => d.status === "PENDING_VERIFICATION").length,
      overdue:         dues.filter((d) => d.status === "OVERDUE").length,
      waived:          dues.filter((d) => d.status === "WAIVED").length,
      totalAmount:     dues.reduce((s, d) => s + Number(d.amount || 0), 0),
      collectedAmount: dues.filter((d) => d.status === "PAID").reduce((s, d) => s + Number(d.amount || 0), 0),
    };

    // Also fetch society maintenance config
    const socRes = await dbQuery(
      `SELECT maintenance_enabled, maintenance_upi_id FROM societies WHERE id = $1`,
      [societyId],
    );
    const soc = socRes?.rows?.[0] || {};

    return res.json({ dues, stats, month: targetMonth, config: soc });
  } catch (err) {
    console.error("Secretary maintenance list error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/secretary/maintenance/dues/:id ─────────────────────────────────

router.patch("/maintenance/dues/:id", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { id }    = req.params;
    const { status, payment_reference, notes } = req.body || {};

    const VALID = ["PENDING", "PENDING_VERIFICATION", "PAID", "OVERDUE", "WAIVED"];
    if (status && !VALID.includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    // Reject edits on dues whose month has been formally closed
    const dueCheck = await dbQuery(
      `SELECT md.due_month FROM maintenance_dues md WHERE md.id = $1 AND md.society_id = $2`,
      [id, societyId],
    );
    if (dueCheck?.rows?.length) {
      const dueMonth = dueCheck.rows[0].due_month;
      const closureCheck = await dbQuery(
        `SELECT status FROM monthly_closures WHERE society_id = $1 AND month = $2`,
        [societyId, dueMonth],
      );
      if (closureCheck?.rows?.[0]?.status === "CLOSED") {
        return res.status(403).json({
          error: "month_closed",
          message: `${dueMonth} is closed. Reopen the month before making changes.`,
        });
      }
    }

    const result = await dbQuery(
      `UPDATE maintenance_dues SET
         status            = COALESCE($1, status),
         payment_reference = COALESCE($2, payment_reference),
         notes             = COALESCE($3, notes),
         payment_date      = CASE WHEN $1 = 'PAID' AND payment_date IS NULL THEN NOW() ELSE payment_date END,
         updated_at        = NOW()
       WHERE id = $4 AND society_id = $5
       RETURNING *`,
      [status || null, payment_reference || null, notes || null, id, societyId],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ due: result.rows[0] });
  } catch (err) {
    console.error("Secretary maintenance dues update error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * True when the due's month has been formally closed — the books are locked and
 * no status change may be recorded against it.
 */
async function isDueMonthClosed(dueId, societyId) {
  const r = await dbQuery(
    `SELECT mc.status
       FROM maintenance_dues md
       JOIN monthly_closures mc
         ON mc.society_id = md.society_id AND mc.month = md.due_month
      WHERE md.id = $1 AND md.society_id = $2`,
    [dueId, societyId],
  );
  return r?.rows?.[0]?.status === "CLOSED";
}

// ── GET /api/secretary/maintenance/pending-verification ───────────────────────
// Dues where the resident has paid by UPI and declared a UTR, waiting for the
// secretary to match it against the society's bank statement.

router.get("/maintenance/pending-verification", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT md.id, md.amount, md.due_month, md.due_date,
              md.claimed_utr, md.claimed_at, md.payment_mode,
              r.name AS resident_name, r.phone AS resident_phone,
              u.unit_number,
              COALESCE(td.name, tf.name) AS tower_name
         FROM maintenance_dues md
         JOIN residents r ON r.id = md.resident_id
         LEFT JOIN units  u  ON u.id  = r.unit_id
         LEFT JOIN towers td ON td.id = u.tower_id
         LEFT JOIN floors f  ON f.id  = u.floor_id
         LEFT JOIN towers tf ON tf.id = f.tower_id
        WHERE md.society_id = $1 AND md.status = 'PENDING_VERIFICATION'
        ORDER BY md.claimed_at ASC`,
      [req.user.societyId],
    );
    return res.json({ dues: result?.rows || [] });
  } catch (err) {
    console.error("Secretary pending-verification error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/maintenance/dues/:id/verify ───────────────────────────
// Confirms a claimed UPI payment → PAID. The UTR becomes the payment reference.

router.post("/maintenance/dues/:id/verify", async (req, res) => {
  try {
    const societyId = req.user.societyId;

    if (await isDueMonthClosed(req.params.id, societyId)) {
      return res.status(403).json({
        error: "month_closed",
        message: "This month is closed. Reopen it before confirming payments.",
      });
    }

    const result = await dbQuery(
      `UPDATE maintenance_dues
          SET status            = 'PAID',
              payment_date      = COALESCE(payment_date, NOW()),
              payment_reference = COALESCE(payment_reference,
                                    CASE WHEN claimed_utr IS NOT NULL
                                         THEN 'UTR:' || claimed_utr || ' | via UPI'
                                         ELSE NULL END),
              payment_mode      = COALESCE(payment_mode, 'UPI'),
              verified_by       = $1,
              verified_at       = NOW(),
              updated_at        = NOW()
        WHERE id = $2 AND society_id = $3 AND status = 'PENDING_VERIFICATION'
        RETURNING *`,
      [req.user.id, req.params.id, societyId],
    );

    if (!result?.rows?.length) {
      return res.status(404).json({ error: "not_found_or_not_pending_verification" });
    }

    const due = result.rows[0];

    // Tell the resident their payment is confirmed — closes the loop that
    // started with the pay link.
    const r = await dbQuery(
      `SELECT r.phone, r.name, s.name AS society_name
         FROM residents r JOIN societies s ON s.id = $2
        WHERE r.id = $1`,
      [due.resident_id, societyId],
    );
    const resident = r?.rows?.[0];
    if (resident?.phone) {
      const amountFmt = Number(due.amount).toLocaleString("en-IN");
      sendWhatsAppText(
        resident.phone,
        `✅ Hi ${resident.name}, your maintenance payment of ₹${amountFmt} for ` +
        `${due.due_month} has been confirmed. Thank you!\n\n— ${resident.society_name} Management`,
      ).catch(() => {});
    }

    return res.json({ due });
  } catch (err) {
    console.error("Secretary verify payment error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/maintenance/dues/:id/reject ───────────────────────────
// The claimed UTR doesn't appear in the bank statement → back to PENDING so the
// resident can pay (or re-declare) using the same link.

router.post("/maintenance/dues/:id/reject", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const reason    = (req.body?.reason || "").trim() || "Payment could not be verified";

    if (await isDueMonthClosed(req.params.id, societyId)) {
      return res.status(403).json({
        error: "month_closed",
        message: "This month is closed. Reopen it before rejecting payments.",
      });
    }

    const result = await dbQuery(
      `UPDATE maintenance_dues
          SET status      = 'PENDING',
              notes       = COALESCE(notes || E'\\n', '') ||
                            'Rejected ' || TO_CHAR(NOW(), 'YYYY-MM-DD') ||
                            ' (UTR ' || COALESCE(claimed_utr, '—') || '): ' || $1,
              claimed_utr = NULL,
              claimed_at  = NULL,
              verified_by = $2,
              verified_at = NOW(),
              updated_at  = NOW()
        WHERE id = $3 AND society_id = $4 AND status = 'PENDING_VERIFICATION'
        RETURNING *`,
      [reason, req.user.id, req.params.id, societyId],
    );

    if (!result?.rows?.length) {
      return res.status(404).json({ error: "not_found_or_not_pending_verification" });
    }

    const due = result.rows[0];

    const r = await dbQuery(
      `SELECT r.phone, r.name, s.name AS society_name
         FROM residents r JOIN societies s ON s.id = $2
        WHERE r.id = $1`,
      [due.resident_id, societyId],
    );
    const resident = r?.rows?.[0];
    if (resident?.phone) {
      sendWhatsAppText(
        resident.phone,
        `⚠️ Hi ${resident.name}, we couldn't verify your maintenance payment for ` +
        `${due.due_month}.\n\nReason: ${reason}\n\nPlease check with the society ` +
        `office before paying again.\n\n— ${resident.society_name} Management`,
      ).catch(() => {});
    }

    return res.json({ due });
  } catch (err) {
    console.error("Secretary reject payment error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/maintenance/generate ──────────────────────────────────
// Generates dues for the current (or specified) month for all enabled residents.

router.post("/maintenance/generate", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month }   = req.body || {};
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = targetMonth.split("-").map(Number);

    const settings = await dbQuery(
      `SELECT unit_id, amount, due_day, bill_recipient FROM maintenance_settings
       WHERE society_id = $1 AND enabled = TRUE
         AND amount IS NOT NULL AND amount > 0
         AND due_day IS NOT NULL`,
      [societyId],
    );

    if (!settings?.rows?.length) {
      return res.json({ created: 0, skipped: 0, message: "No active maintenance settings found." });
    }

    // Fetch society info needed for the payment link
    const socRes = await dbQuery(
      `SELECT name, maintenance_upi_id FROM societies WHERE id = $1`, [societyId],
    );
    const societyName  = socRes?.rows?.[0]?.name || "Society";
    const societyUpiId = socRes?.rows?.[0]?.maintenance_upi_id || null;
    const payEnabled   = isPaymentConfigured();

    // If an expense sheet exists for this month, add per-unit share to each unit's base
    const sheetRes = await dbQuery(
      `SELECT fixed_items, variable_items FROM maintenance_expense_sheets
       WHERE society_id = $1 AND month = $2`,
      [societyId, targetMonth],
    );
    const sheet        = sheetRes?.rows?.[0];
    const enabledCount = settings.rows.length;

    let expenseShare  = 0;
    let breakdownJson = null;

    if (sheet && enabledCount > 0) {
      const allItems = [...(sheet.fixed_items || []), ...(sheet.variable_items || [])];
      expenseShare   = Math.round(
        (allItems.reduce((s, item) => s + Number(item.total_amount || 0), 0) / enabledCount) * 100,
      ) / 100;
      breakdownJson = JSON.stringify({
        fixed_items:    sheet.fixed_items,
        variable_items: sheet.variable_items,
        unit_count:     enabledCount,
      });
    }

    let created = 0;
    let skipped = 0;

    for (const s of settings.rows) {
      // Bill based on per-unit setting; fall back to the other type if the preferred one is absent
      const preferred   = s.bill_recipient || "OWNER";
      const occupantRes = await dbQuery(
        `SELECT id, name, phone, email FROM residents
         WHERE unit_id = $1
         ORDER BY CASE WHEN resident_type = $2 THEN 0 ELSE 1 END
         LIMIT 1`,
        [s.unit_id, preferred],
      );
      const occupant = occupantRes?.rows?.[0];
      if (!occupant) { skipped++; continue; }

      const dueDate    = new Date(Date.UTC(year, mon - 1, s.due_day));
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      const baseAmount  = Number(s.amount);
      const totalAmount = Math.round((baseAmount + expenseShare) * 100) / 100;

      const r = await dbQuery(
        `INSERT INTO maintenance_dues
           (resident_id, society_id, amount, base_amount, expense_share, breakdown, due_month, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
         ON CONFLICT (resident_id, due_month) DO NOTHING
         RETURNING id`,
        [occupant.id, societyId, totalAmount, baseAmount, expenseShare, breakdownJson, targetMonth, dueDateStr],
      );

      if (!r?.rows?.length) { skipped++; continue; }

      const dueId = r.rows[0].id;
      created++;

      // Mint a payment link (Razorpay or UPI) — persisted by the service
      if (payEnabled) {
        await createDuePaymentLink({
          dueId, societyId, residentId: occupant.id,
          residentName:  occupant.name  || "Resident",
          residentEmail: occupant.email || null,
          residentPhone: occupant.phone || null,
          amount:     totalAmount,
          dueMonth:   targetMonth,
          dueDate:    dueDateStr,
          societyName, societyUpiId,
        });
      }
    }

    return res.json({
      created, skipped, month: targetMonth,
      paymentProvider: payEnabled ? activeProvider() : null,
    });
  } catch (err) {
    console.error("Secretary maintenance generate error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/maintenance/send-reminders ────────────────────────────

router.post("/maintenance/send-reminders", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month }   = req.body || {};
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const socRes = await dbQuery(
      `SELECT name, maintenance_upi_id FROM societies WHERE id = $1`,
      [societyId],
    );
    const soc = socRes?.rows?.[0] || {};

    const dues = await dbQuery(
      `SELECT md.id, md.amount, md.due_date, md.payment_link,
              r.name  AS resident_name,
              r.phone AS resident_phone,
              r.email AS resident_email
       FROM maintenance_dues md
       JOIN residents r ON r.id = md.resident_id
       WHERE md.society_id = $1 AND md.status = 'PENDING'
         AND md.due_month = $2
         AND md.due_date - INTERVAL '7 days' <= CURRENT_DATE
         AND md.reminder_sent_at IS NULL`,
      [societyId, targetMonth],
    );

    let sent = 0;
    let failed = 0;
    const emailEnabled = isEmailConfigured();

    for (const due of dues?.rows || []) {
      const hasEmail = !!due.resident_email;
      const hasPhone = !!due.resident_phone;
      if (!hasEmail && !hasPhone) { failed++; continue; }

      let notified = false;

      // Prefer email (free)
      if (hasEmail && emailEnabled) {
        const r = await sendMaintenanceReminderEmail({
          to:           due.resident_email,
          residentName: due.resident_name,
          societyName:  soc.name || "Society",
          amount:       due.amount,
          dueMonth:     targetMonth,
          dueDate:      due.due_date,
          upiId:        soc.maintenance_upi_id || null,
          paymentLink:  due.payment_link || null,
        });
        if (r.sent) notified = true;
      }

      // Fall back to WhatsApp
      if (!notified && hasPhone) {
        const dueDateFmt = new Date(due.due_date).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        });
        const amountFmt = Number(due.amount).toLocaleString("en-IN");
        let msg = `Hi ${due.resident_name},\n\nYour monthly maintenance of ₹${amountFmt} for ${targetMonth} is due on ${dueDateFmt}.`;
        if (due.payment_link) {
          msg += `\n\n💳 *Pay now:* ${due.payment_link}`;
        } else if (soc.maintenance_upi_id) {
          msg += `\n\nPay via UPI: *${soc.maintenance_upi_id}*`;
        }
        msg += `\n\nPlease pay on time.\n\n— ${soc.name || "Society"} Management`;
        try {
          await sendWhatsAppText(due.resident_phone, msg);
          notified = true;
        } catch (e) {
          console.error(`Secretary reminder WhatsApp failed for ${due.resident_phone}:`, e.message);
        }
      }

      if (notified) {
        await dbQuery(
          `UPDATE maintenance_dues SET reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [due.id],
        );
        sent++;
      } else {
        failed++;
      }
    }

    return res.json({ sent, failed, total: dues?.rows?.length || 0 });
  } catch (err) {
    console.error("Secretary send-reminders error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── Default expense line items ────────────────────────────────────────────────

const DEFAULT_FIXED_ITEMS = [
  { particulars: "Sinking Fund", total_amount: 0 },
  { particulars: "Structural Repair Fee", total_amount: 0 },
  { particulars: "Insurance", total_amount: 0 },
  { particulars: "Parking Fee", total_amount: 0 },
  { particulars: "Security Fee", total_amount: 0 },
  { particulars: "Housekeeping Fee", total_amount: 0 },
  { particulars: "Society Management Fee", total_amount: 0 },
  { particulars: "Lift Maintenance AMC", total_amount: 0 },
];

const DEFAULT_VARIABLE_ITEMS = [
  { particulars: "Garbage Collection Fee", total_amount: 0 },
  { particulars: "Electricity Bill", total_amount: 0 },
  { particulars: "Generator Fuel", total_amount: 0 },
  { particulars: "Water Tank Cleaning Fee", total_amount: 0 },
  { particulars: "Non-Occupancy Charges", total_amount: 0 },
];

// ── GET /api/secretary/maintenance/expense-sheet ──────────────────────────────
// Returns the saved expense sheet for a month, or a default empty one.

router.get("/maintenance/expense-sheet", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month }   = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [sheetRes, countRes] = await Promise.all([
      dbQuery(
        `SELECT * FROM maintenance_expense_sheets WHERE society_id = $1 AND month = $2`,
        [societyId, targetMonth],
      ),
      dbQuery(
        `SELECT COUNT(*) AS count FROM maintenance_settings WHERE society_id = $1 AND enabled = TRUE AND unit_id IS NOT NULL`,
        [societyId],
      ),
    ]);

    const count = Number(countRes?.rows?.[0]?.count || 0);
    const sheet = sheetRes?.rows?.[0];

    if (sheet) {
      return res.json({ sheet, count, month: targetMonth });
    }

    // Return default empty template so the frontend can pre-populate the form
    return res.json({
      sheet: {
        month:          targetMonth,
        fixed_items:    DEFAULT_FIXED_ITEMS,
        variable_items: DEFAULT_VARIABLE_ITEMS,
        interest_rate:  21.00,
      },
      count,
      month: targetMonth,
    });
  } catch (err) {
    console.error("Secretary expense-sheet get error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PUT /api/secretary/maintenance/expense-sheet ──────────────────────────────
// Upserts the expense sheet for a month.

router.put("/maintenance/expense-sheet", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { month, fixed_items, variable_items, interest_rate } = req.body || {};
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const result = await dbQuery(
      `INSERT INTO maintenance_expense_sheets
         (society_id, month, fixed_items, variable_items, interest_rate, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (society_id, month) DO UPDATE SET
         fixed_items    = EXCLUDED.fixed_items,
         variable_items = EXCLUDED.variable_items,
         interest_rate  = EXCLUDED.interest_rate,
         updated_at     = NOW()
       RETURNING *`,
      [
        societyId,
        targetMonth,
        JSON.stringify(fixed_items    || DEFAULT_FIXED_ITEMS),
        JSON.stringify(variable_items || DEFAULT_VARIABLE_ITEMS),
        Number(interest_rate) || 21.00,
      ],
    );

    return res.json({ sheet: result.rows[0] });
  } catch (err) {
    console.error("Secretary expense-sheet save error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance/bill-preview ───────────────────────────────
// Returns the computed bill breakdown for a specific resident and month.

router.get("/maintenance/bill-preview", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month, residentId } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    if (!residentId) return res.status(400).json({ error: "resident_id_required" });

    const [sheetRes, resRes, countRes, socRes] = await Promise.all([
      dbQuery(
        `SELECT * FROM maintenance_expense_sheets WHERE society_id = $1 AND month = $2`,
        [societyId, targetMonth],
      ),
      dbQuery(
        `SELECT r.name, r.phone, u.unit_number,
                COALESCE(td.name, tf.name) AS tower_name,
                ms.amount  AS base_amount,
                ms.due_day AS due_day
         FROM residents r
         JOIN units u ON u.id = r.unit_id
         LEFT JOIN towers td ON td.id = u.tower_id
         LEFT JOIN floors f  ON f.id  = u.floor_id
         LEFT JOIN towers tf ON tf.id = f.tower_id
         LEFT JOIN maintenance_settings ms ON ms.unit_id = r.unit_id
         WHERE r.id = $1 AND r.society_id = $2`,
        [residentId, societyId],
      ),
      dbQuery(
        `SELECT COUNT(*) AS count FROM maintenance_settings WHERE society_id = $1 AND enabled = TRUE AND unit_id IS NOT NULL`,
        [societyId],
      ),
      dbQuery(
        `SELECT name, address FROM societies WHERE id = $1`,
        [societyId],
      ),
    ]);

    if (!resRes?.rows?.length) return res.status(404).json({ error: "resident_not_found" });

    const resident   = resRes.rows[0];
    const sheet      = sheetRes?.rows?.[0];
    const unitCount  = Math.max(1, Number(countRes?.rows?.[0]?.count || 1));
    const baseAmount = Number(resident.base_amount || 0);

    const fixedItems = (sheet?.fixed_items || DEFAULT_FIXED_ITEMS).map((item) => ({
      particulars:  item.particulars,
      total_amount: Number(item.total_amount || 0),
      per_unit:     Math.round((Number(item.total_amount || 0) / unitCount) * 100) / 100,
    }));

    const variableItems = (sheet?.variable_items || DEFAULT_VARIABLE_ITEMS).map((item) => ({
      particulars:  item.particulars,
      total_amount: Number(item.total_amount || 0),
      per_unit:     Math.round((Number(item.total_amount || 0) / unitCount) * 100) / 100,
    }));

    const fixedTotal    = fixedItems.reduce((s, i) => s + i.per_unit, 0);
    const variableTotal = variableItems.reduce((s, i) => s + i.per_unit, 0);
    const expenseShare  = Math.round((fixedTotal + variableTotal) * 100) / 100;

    // Previous month's unpaid dues
    const prevMonthDate = new Date(targetMonth + "-01");
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonth = prevMonthDate.toISOString().slice(0, 7);

    const prevRes = await dbQuery(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM maintenance_dues
       WHERE resident_id = $1 AND due_month = $2 AND status IN ('PENDING','OVERDUE')`,
      [residentId, prevMonth],
    );
    const previouslyDue  = Number(prevRes?.rows?.[0]?.total || 0);
    const interestRate   = Number(sheet?.interest_rate || 21.00);
    const interestAmount = Math.round((previouslyDue * interestRate / 1200) * 100) / 100;
    const total          = Math.round((baseAmount + expenseShare + previouslyDue + interestAmount) * 100) / 100;

    const society = socRes?.rows?.[0] || {};

    return res.json({
      society: {
        name:    society.name    || "",
        address: society.address || "",
      },
      resident: {
        name:        resident.name,
        unit_number: resident.tower_name
          ? `${resident.tower_name} · ${resident.unit_number}`
          : resident.unit_number,
      },
      month:          targetMonth,
      fixed_items:    fixedItems,
      variable_items: variableItems,
      fixed_total:    Math.round(fixedTotal    * 100) / 100,
      variable_total: Math.round(variableTotal * 100) / 100,
      base_amount:    baseAmount,
      expense_share:  expenseShare,
      previously_due: previouslyDue,
      interest_rate:  interestRate,
      interest_amount: interestAmount,
      total,
      unit_count: unitCount,
    });
  } catch (err) {
    console.error("Secretary bill-preview error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/secretary/maintenance/config ───────────────────────────────────
// Toggle feature on/off + update UPI ID for the society.

router.patch("/maintenance/config", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { maintenance_enabled, maintenance_upi_id, maintenance_payee_name } = req.body || {};

    if (maintenance_upi_id != null && maintenance_upi_id !== "" && !isValidVpa(maintenance_upi_id)) {
      return res.status(400).json({ error: "invalid_upi_id", message: "UPI ID must look like name@bank" });
    }

    const result = await dbQuery(
      `UPDATE societies SET
         maintenance_enabled    = COALESCE($1, maintenance_enabled),
         maintenance_upi_id     = COALESCE($2, maintenance_upi_id),
         maintenance_payee_name = COALESCE($3, maintenance_payee_name)
       WHERE id = $4
       RETURNING id, maintenance_enabled, maintenance_upi_id, maintenance_payee_name`,
      [
        maintenance_enabled    != null ? !!maintenance_enabled  : null,
        maintenance_upi_id     != null ? maintenance_upi_id     : null,
        maintenance_payee_name != null ? maintenance_payee_name : null,
        societyId,
      ],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ config: result.rows[0] });
  } catch (err) {
    console.error("Secretary maintenance config error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance/invoice/:dueId/pdf ─────────────────────────
// Downloads the maintenance bill PDF for a specific due.

router.get("/maintenance/invoice/:dueId/pdf", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { dueId } = req.params;

    // Fetch due + resident + society data
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
         WHERE md.id = $1 AND md.society_id = $2`,
        [dueId, societyId],
      ),
      dbQuery(
        `SELECT name, address, maintenance_upi_id, code FROM societies WHERE id = $1`,
        [societyId],
      ),
    ]);

    if (!dueRes?.rows?.length) return res.status(404).json({ error: "due_not_found" });

    const due     = dueRes.rows[0];
    const society = socRes.rows[0] || {};

    // Get/create invoice number
    const invoiceNumber = await getOrCreateInvoiceNumber(dueId, societyId, society.code);

    // Build bill data from stored breakdown if available, otherwise compute live
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
      bill = await computeBill(societyId, due.resident_id, due.due_month);
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
    console.error("Secretary invoice PDF error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance/collection-register/pdf ────────────────────
// Downloads the full collection register for a month as a PDF.

router.get("/maintenance/collection-register/pdf", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month }   = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [duesRes, socRes, closureRes] = await Promise.all([
      dbQuery(
        `SELECT md.*, r.name AS resident_name, u.unit_number,
                COALESCE(td.name, tf.name) AS tower_name
         FROM maintenance_dues md
         JOIN residents r ON r.id = md.resident_id
         JOIN units u ON u.id = r.unit_id
         LEFT JOIN towers td ON td.id = u.tower_id
         LEFT JOIN floors f  ON f.id  = u.floor_id
         LEFT JOIN towers tf ON tf.id = f.tower_id
         WHERE md.society_id = $1 AND md.due_month = $2
         ORDER BY COALESCE(td.name, tf.name) NULLS LAST, u.unit_number, r.name`,
        [societyId, targetMonth],
      ),
      dbQuery(`SELECT name, address, code FROM societies WHERE id = $1`, [societyId]),
      dbQuery(`SELECT status FROM monthly_closures WHERE society_id = $1 AND month = $2`, [societyId, targetMonth]),
    ]);

    const dues    = duesRes?.rows || [];
    const society = socRes?.rows?.[0] || {};
    const closureStatus = closureRes?.rows?.[0]?.status || "OPEN";

    const stats = {
      totalAmount:     dues.reduce((s, d) => s + Number(d.amount || 0), 0),
      collectedAmount: dues.filter((d) => d.status === "PAID").reduce((s, d) => s + Number(d.amount || 0), 0),
      pending:         dues.filter((d) => d.status === "PENDING").length,
      overdue:         dues.filter((d) => d.status === "OVERDUE").length,
      waived:          dues.filter((d) => d.status === "WAIVED").length,
    };

    const buffer = await generateCollectionRegisterPdf(dues, stats, society, targetMonth, closureStatus);

    const filename = `collection-register-${targetMonth}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Secretary collection register PDF error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance/closure/:month ─────────────────────────────
// Returns the closure record for a month, or { status: 'OPEN' } if not closed.

router.get("/maintenance/closure/:month", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { month } = req.params;

    const result = await dbQuery(
      `SELECT mc.*, aa.username AS closed_by_username
       FROM monthly_closures mc
       LEFT JOIN auth_accounts aa ON aa.id = mc.closed_by
       WHERE mc.society_id = $1 AND mc.month = $2`,
      [societyId, month],
    );

    if (!result?.rows?.length) {
      return res.json({ status: "OPEN", month });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Secretary get closure error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/maintenance/close-month ───────────────────────────────
// Closes the books for a month: flips PENDING → OVERDUE, computes totals, locks.

router.post("/maintenance/close-month", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { month, notes } = req.body || {};
    if (!month) return res.status(400).json({ error: "month_required" });

    // Idempotency — already closed?
    const existing = await dbQuery(
      `SELECT id, status FROM monthly_closures WHERE society_id = $1 AND month = $2`,
      [societyId, month],
    );
    if (existing?.rows?.[0]?.status === "CLOSED") {
      return res.status(409).json({ error: "already_closed", message: `${month} is already closed.` });
    }

    // Flip all PENDING dues to OVERDUE for this month
    await dbQuery(
      `UPDATE maintenance_dues SET status = 'OVERDUE', updated_at = NOW()
       WHERE society_id = $1 AND due_month = $2 AND status = 'PENDING'`,
      [societyId, month],
    );

    // Compute collection totals
    const totalsRes = await dbQuery(
      `SELECT
         COUNT(*)                                                         AS total_dues,
         COALESCE(SUM(amount), 0)                                        AS total_billed,
         COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'),   0)       AS total_collected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'WAIVED'), 0)       AS total_waived,
         COALESCE(SUM(amount) FILTER (WHERE status = 'OVERDUE'),0)       AS total_overdue
       FROM maintenance_dues
       WHERE society_id = $1 AND due_month = $2`,
      [societyId, month],
    );
    const t = totalsRes?.rows?.[0] || {};

    // Compute total expenses from expense sheet
    const sheetRes = await dbQuery(
      `SELECT fixed_items, variable_items FROM maintenance_expense_sheets
       WHERE society_id = $1 AND month = $2`,
      [societyId, month],
    );
    const sheet = sheetRes?.rows?.[0];
    const allItems = [...(sheet?.fixed_items || []), ...(sheet?.variable_items || [])];
    const totalExpenses = allItems.reduce((s, i) => s + Number(i.total_amount || 0), 0);

    const totalCollected = Number(t.total_collected || 0);
    const surplusDeficit = Math.round((totalCollected - totalExpenses) * 100) / 100;

    // Upsert the closure record
    const closureRes = await dbQuery(
      `INSERT INTO monthly_closures
         (society_id, month, status, total_dues, total_billed, total_collected,
          total_waived, total_overdue, total_expenses, surplus_deficit,
          closed_by, closed_at, notes, updated_at)
       VALUES ($1, $2, 'CLOSED', $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW())
       ON CONFLICT (society_id, month) DO UPDATE SET
         status          = 'CLOSED',
         total_dues      = EXCLUDED.total_dues,
         total_billed    = EXCLUDED.total_billed,
         total_collected = EXCLUDED.total_collected,
         total_waived    = EXCLUDED.total_waived,
         total_overdue   = EXCLUDED.total_overdue,
         total_expenses  = EXCLUDED.total_expenses,
         surplus_deficit = EXCLUDED.surplus_deficit,
         closed_by       = EXCLUDED.closed_by,
         closed_at       = EXCLUDED.closed_at,
         notes           = COALESCE(EXCLUDED.notes, monthly_closures.notes),
         updated_at      = NOW()
       RETURNING *`,
      [
        societyId, month,
        Number(t.total_dues      || 0),
        Number(t.total_billed    || 0),
        totalCollected,
        Number(t.total_waived    || 0),
        Number(t.total_overdue   || 0),
        Math.round(totalExpenses * 100) / 100,
        surplusDeficit,
        req.user.id,
        notes || null,
      ],
    );

    return res.json({ closure: closureRes.rows[0] });
  } catch (err) {
    console.error("Secretary close-month error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/maintenance/reopen-month ──────────────────────────────
// Reopens a closed month (requires a reason for audit trail).

router.post("/maintenance/reopen-month", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { month, reason } = req.body || {};
    if (!month)  return res.status(400).json({ error: "month_required" });
    if (!reason) return res.status(400).json({ error: "reason_required" });

    const result = await dbQuery(
      `UPDATE monthly_closures
       SET status        = 'OPEN',
           reopened_by   = $1,
           reopened_at   = NOW(),
           reopen_reason = $2,
           updated_at    = NOW()
       WHERE society_id = $3 AND month = $4 AND status = 'CLOSED'
       RETURNING *`,
      [req.user.id, reason, societyId, month],
    );

    if (!result?.rows?.length) {
      return res.status(404).json({ error: "not_found_or_not_closed" });
    }

    return res.json({ closure: result.rows[0] });
  } catch (err) {
    console.error("Secretary reopen-month error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance/closure/:month/pdf ─────────────────────────
// Downloads the closure summary PDF (must be a closed month).

router.get("/maintenance/closure/:month/pdf", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { month } = req.params;

    const [closureRes, sheetRes, socRes] = await Promise.all([
      dbQuery(
        `SELECT mc.*, aa.username AS closed_by_username
         FROM monthly_closures mc
         LEFT JOIN auth_accounts aa ON aa.id = mc.closed_by
         WHERE mc.society_id = $1 AND mc.month = $2`,
        [societyId, month],
      ),
      dbQuery(
        `SELECT fixed_items, variable_items FROM maintenance_expense_sheets
         WHERE society_id = $1 AND month = $2`,
        [societyId, month],
      ),
      dbQuery(`SELECT name, address FROM societies WHERE id = $1`, [societyId]),
    ]);

    if (!closureRes?.rows?.length) {
      return res.status(404).json({ error: "closure_not_found", message: "Close the month first." });
    }

    const closure     = closureRes.rows[0];
    const expenseSheet = sheetRes?.rows?.[0] || null;
    const society     = socRes?.rows?.[0]    || {};

    const buffer = await generateClosurePdf(closure, expenseSheet, society);
    const filename = `closure-${month}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Secretary closure PDF error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/maintenance/tally ──────────────────────────────────────
// Monthly account tally — one row per month with dues stats + closure status.

router.get("/maintenance/tally", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { year }  = req.query;

    let monthFilter = "";
    const params = [societyId];
    if (year && /^\d{4}$/.test(year)) {
      params.push(`${year}-%`);
      monthFilter = ` AND md.due_month LIKE $${params.length}`;
    }

    // Aggregate dues per month
    const duesRes = await dbQuery(
      `SELECT
         md.due_month                                                     AS month,
         COUNT(*)                                                         AS total_dues,
         COALESCE(SUM(md.amount), 0)                                      AS total_billed,
         COALESCE(SUM(md.amount) FILTER (WHERE md.status = 'PAID'),   0) AS total_collected,
         COALESCE(SUM(md.amount) FILTER (WHERE md.status = 'WAIVED'), 0) AS total_waived,
         COALESCE(SUM(md.amount) FILTER (WHERE md.status = 'OVERDUE'),0) AS total_overdue
       FROM maintenance_dues md
       WHERE md.society_id = $1${monthFilter}
       GROUP BY md.due_month
       ORDER BY md.due_month DESC`,
      params,
    );

    const months = duesRes?.rows || [];

    // Fetch closures for these months
    const monthList = months.map((m) => m.month);
    let closureMap  = {};
    if (monthList.length) {
      const placeholders = monthList.map((_, i) => `$${i + 2}`).join(", ");
      const closuresRes  = await dbQuery(
        `SELECT month, status, total_expenses, surplus_deficit, closed_at
         FROM monthly_closures
         WHERE society_id = $1 AND month IN (${placeholders})`,
        [societyId, ...monthList],
      );
      (closuresRes?.rows || []).forEach((c) => { closureMap[c.month] = c; });
    }

    // Merge — for open months, compute expenses live from expense sheet
    const expenseRes = await dbQuery(
      `SELECT month,
              (SELECT COALESCE(SUM(val->>'total_amount'), 0)::NUMERIC
               FROM jsonb_array_elements(fixed_items || variable_items) AS val) AS total_expenses
       FROM maintenance_expense_sheets
       WHERE society_id = $1${year ? ` AND month LIKE '${year}-%'` : ""}`,
      [societyId],
    );
    const expenseMap = {};
    (expenseRes?.rows || []).forEach((e) => { expenseMap[e.month] = Number(e.total_expenses || 0); });

    const tally = months.map((m) => {
      const closure  = closureMap[m.month];
      const expenses = closure ? Number(closure.total_expenses || 0) : (expenseMap[m.month] || 0);
      const collected = Number(m.total_collected || 0);
      return {
        month:          m.month,
        total_dues:     Number(m.total_dues      || 0),
        total_billed:   Number(m.total_billed    || 0),
        total_collected: collected,
        total_waived:   Number(m.total_waived    || 0),
        total_overdue:  Number(m.total_overdue   || 0),
        total_expenses: expenses,
        surplus_deficit: Math.round((collected - expenses) * 100) / 100,
        status:         closure?.status || "OPEN",
        closed_at:      closure?.closed_at || null,
      };
    });

    return res.json({ tally });
  } catch (err) {
    console.error("Secretary tally error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── Announcements ─────────────────────────────────────────────────────────────

// POST /api/secretary/announcements
router.post("/announcements", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { title, body, category = "GENERAL", priority = "NORMAL", pinned = false } = req.body || {};

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "title_and_body_required" });
    }
    if (!["NORMAL", "URGENT"].includes(priority)) {
      return res.status(400).json({ error: "invalid_priority" });
    }

    const result = await dbQuery(
      `INSERT INTO announcements (society_id, title, body, category, priority, pinned, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [societyId, title.trim(), body.trim(), category || "GENERAL", priority, !!pinned, req.user.id],
    );

    return res.status(201).json({ announcement: result.rows[0] });
  } catch (err) {
    console.error("Create announcement error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/secretary/announcements
router.get("/announcements", async (req, res) => {
  try {
    const societyId = req.user.societyId;

    const result = await dbQuery(
      `SELECT a.*,
              aa.username AS created_by_username
       FROM announcements a
       LEFT JOIN auth_accounts aa ON aa.id = a.created_by
       WHERE a.society_id = $1
       ORDER BY a.pinned DESC, a.created_at DESC`,
      [societyId],
    );

    return res.json({ announcements: result?.rows || [] });
  } catch (err) {
    console.error("List announcements error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /api/secretary/announcements/:id
router.patch("/announcements/:id", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { id }    = req.params;
    const { title, body, category, priority, pinned } = req.body || {};

    const result = await dbQuery(
      `UPDATE announcements
       SET title      = COALESCE($1, title),
           body       = COALESCE($2, body),
           category   = COALESCE($3, category),
           priority   = COALESCE($4, priority),
           pinned     = COALESCE($5, pinned),
           updated_at = NOW()
       WHERE id = $6 AND society_id = $7
       RETURNING *`,
      [title || null, body || null, category || null, priority || null,
       pinned != null ? !!pinned : null, id, societyId],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ announcement: result.rows[0] });
  } catch (err) {
    console.error("Update announcement error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// DELETE /api/secretary/announcements/:id
router.delete("/announcements/:id", async (req, res) => {
  try {
    const societyId = req.user.societyId;
    const { id }    = req.params;

    const result = await dbQuery(
      `DELETE FROM announcements WHERE id = $1 AND society_id = $2 RETURNING id`,
      [id, societyId],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete announcement error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/towers ────────────────────────────────────────────────

router.get("/towers", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `SELECT id, name FROM towers WHERE society_id = $1 ORDER BY name`,
      [societyId],
    );
    return res.json({ towers: result?.rows || [] });
  } catch (err) {
    console.error("Secretary towers error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/broadcast/preview ─────────────────────────────────────
// Returns the number of residents that would receive the broadcast for a given target.

router.get("/broadcast/preview", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { target, tower_id } = req.query;

    let sql, params;
    if (target === "OVERDUE") {
      sql = `SELECT COUNT(DISTINCT r.id) AS count
             FROM residents r
             JOIN maintenance_dues md ON md.resident_id = r.id
             WHERE r.society_id = $1 AND md.status = 'OVERDUE' AND r.phone IS NOT NULL`;
      params = [societyId];
    } else if (target === "TOWER" && tower_id) {
      sql = `SELECT COUNT(DISTINCT r.id) AS count
             FROM residents r
             JOIN units u ON u.id = r.unit_id
             LEFT JOIN floors f ON f.id = u.floor_id
             WHERE r.society_id = $1
               AND (u.tower_id = $2 OR f.tower_id = $2)
               AND r.phone IS NOT NULL`;
      params = [societyId, tower_id];
    } else {
      sql = `SELECT COUNT(DISTINCT r.id) AS count
             FROM residents r
             WHERE r.society_id = $1 AND r.phone IS NOT NULL`;
      params = [societyId];
    }

    const result = await dbQuery(sql, params);
    return res.json({ count: Number(result?.rows?.[0]?.count || 0) });
  } catch (err) {
    console.error("Broadcast preview error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/broadcast ────────────────────────────────────────────
// Sends a WhatsApp message to a filtered group of residents and logs the broadcast.

router.post("/broadcast", async (req, res) => {
  try {
    const { societyId, id: sentByUserId } = req.user;
    const { message, target = "ALL", tower_id } = req.body || {};

    if (!message?.trim()) return res.status(400).json({ error: "message_required" });

    let sql, params;
    if (target === "OVERDUE") {
      sql = `SELECT DISTINCT r.phone, r.name FROM residents r
             JOIN maintenance_dues md ON md.resident_id = r.id
             WHERE r.society_id = $1 AND md.status = 'OVERDUE' AND r.phone IS NOT NULL`;
      params = [societyId];
    } else if (target === "TOWER" && tower_id) {
      sql = `SELECT DISTINCT r.phone, r.name FROM residents r
             JOIN units u ON u.id = r.unit_id
             LEFT JOIN floors f ON f.id = u.floor_id
             WHERE r.society_id = $1
               AND (u.tower_id = $2 OR f.tower_id = $2)
               AND r.phone IS NOT NULL`;
      params = [societyId, tower_id];
    } else {
      sql = `SELECT DISTINCT r.phone, r.name FROM residents r
             WHERE r.society_id = $1 AND r.phone IS NOT NULL`;
      params = [societyId];
    }

    const recipientsRes = await dbQuery(sql, params);
    const recipients    = recipientsRes?.rows || [];

    const results  = await Promise.allSettled(
      recipients.map((r) => sendWhatsAppText(r.phone, message.trim())),
    );
    const sentCount = results.filter((r) => r.status === "fulfilled").length;

    await dbQuery(
      `INSERT INTO outbound_broadcasts
         (society_id, sent_by_user_id, message, target_type, target_meta, is_emergency, recipient_count, sent_count)
       VALUES ($1, $2, $3, $4, $5, false, $6, $7)`,
      [societyId, sentByUserId, message.trim(), target,
       JSON.stringify(target === "TOWER" ? { tower_id } : {}),
       recipients.length, sentCount],
    );

    return res.json({ sent: sentCount, total: recipients.length });
  } catch (err) {
    console.error("Broadcast send error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/emergency-alert ──────────────────────────────────────
// Sends an emergency WhatsApp blast to ALL residents and creates a pinned URGENT announcement.

router.post("/emergency-alert", async (req, res) => {
  try {
    const { societyId, id: sentByUserId } = req.user;
    const { message, title = "Emergency Notice" } = req.body || {};

    if (!message?.trim()) return res.status(400).json({ error: "message_required" });

    const recipientsRes = await dbQuery(
      `SELECT DISTINCT r.phone, r.name FROM residents r
       WHERE r.society_id = $1 AND r.phone IS NOT NULL`,
      [societyId],
    );
    const recipients = recipientsRes?.rows || [];

    const results  = await Promise.allSettled(
      recipients.map((r) => sendWhatsAppText(r.phone, `🚨 EMERGENCY ALERT\n\n${message.trim()}`)),
    );
    const sentCount = results.filter((r) => r.status === "fulfilled").length;

    // Create a pinned URGENT announcement so residents see it in the portal too.
    const annResult = await dbQuery(
      `INSERT INTO announcements (society_id, title, body, category, priority, pinned, created_by)
       VALUES ($1, $2, $3, 'EMERGENCY', 'URGENT', true, $4)
       RETURNING id`,
      [societyId, title.trim(), message.trim(), sentByUserId],
    );
    const announcementId = annResult?.rows?.[0]?.id || null;

    await dbQuery(
      `INSERT INTO outbound_broadcasts
         (society_id, sent_by_user_id, message, target_type, is_emergency, announcement_id, recipient_count, sent_count)
       VALUES ($1, $2, $3, 'ALL', true, $4, $5, $6)`,
      [societyId, sentByUserId, message.trim(), announcementId, recipients.length, sentCount],
    );

    return res.json({ sent: sentCount, total: recipients.length, announcement_id: announcementId });
  } catch (err) {
    console.error("Emergency alert error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/broadcasts ────────────────────────────────────────────

router.get("/broadcasts", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { limit = 20 } = req.query;
    const result = await dbQuery(
      `SELECT id, message, target_type, target_meta, is_emergency,
              recipient_count, sent_count, created_at
       FROM outbound_broadcasts
       WHERE society_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [societyId, Number(limit)],
    );
    return res.json({ broadcasts: result?.rows || [] });
  } catch (err) {
    console.error("Broadcast history error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/events ─────────────────────────────────────────────────

router.get("/events", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `SELECT e.*,
              COUNT(r.id)                                      AS rsvp_total,
              COUNT(r.id) FILTER (WHERE r.response = 'YES')   AS rsvp_yes,
              COUNT(r.id) FILTER (WHERE r.response = 'NO')    AS rsvp_no,
              COUNT(r.id) FILTER (WHERE r.response = 'MAYBE') AS rsvp_maybe
       FROM society_events e
       LEFT JOIN event_rsvps r ON r.event_id = e.id
       WHERE e.society_id = $1
       GROUP BY e.id
       ORDER BY e.event_date DESC`,
      [societyId],
    );
    return res.json({ events: result?.rows || [] });
  } catch (err) {
    console.error("Secretary list events error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/events ────────────────────────────────────────────────

router.post("/events", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { title, description, event_date, location } = req.body || {};

    if (!title?.trim()) return res.status(400).json({ error: "title_required" });
    if (!event_date)    return res.status(400).json({ error: "event_date_required" });

    const result = await dbQuery(
      `INSERT INTO society_events (society_id, title, description, event_date, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [societyId, title.trim(), description?.trim() || null, new Date(event_date), location?.trim() || null],
    );
    return res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    console.error("Secretary create event error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/secretary/events/:id ──────────────────────────────────────────

router.patch("/events/:id", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { title, description, event_date, location } = req.body || {};

    const result = await dbQuery(
      `UPDATE society_events
       SET title       = COALESCE($1, title),
           description = COALESCE($2, description),
           event_date  = COALESCE($3, event_date),
           location    = COALESCE($4, location),
           updated_at  = NOW()
       WHERE id = $5 AND society_id = $6
       RETURNING *`,
      [title?.trim() || null, description?.trim() || null,
       event_date ? new Date(event_date) : null,
       location?.trim() || null,
       req.params.id, societyId],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ event: result.rows[0] });
  } catch (err) {
    console.error("Secretary update event error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/secretary/events/:id ─────────────────────────────────────────

router.delete("/events/:id", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `DELETE FROM society_events WHERE id = $1 AND society_id = $2 RETURNING id`,
      [req.params.id, societyId],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Secretary delete event error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/polls ──────────────────────────────────────────────────

router.get("/polls", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `SELECT p.*,
              COUNT(v.id) AS total_votes
       FROM polls p
       LEFT JOIN poll_votes v ON v.poll_id = p.id
       WHERE p.society_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [societyId],
    );
    return res.json({ polls: result?.rows || [] });
  } catch (err) {
    console.error("Secretary list polls error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/polls/:id/results ─────────────────────────────────────

router.get("/polls/:id/results", async (req, res) => {
  try {
    const { societyId } = req.user;
    const pollRes = await dbQuery(
      `SELECT * FROM polls WHERE id = $1 AND society_id = $2`,
      [req.params.id, societyId],
    );
    if (!pollRes?.rows?.length) return res.status(404).json({ error: "not_found" });
    const poll = pollRes.rows[0];

    const votesRes = await dbQuery(
      `SELECT option_index, COUNT(*) AS count
       FROM poll_votes WHERE poll_id = $1
       GROUP BY option_index`,
      [req.params.id],
    );
    const voteMap = {};
    for (const row of votesRes?.rows || []) voteMap[row.option_index] = Number(row.count);
    const options = (poll.options || []).map((opt, i) => ({
      label: opt, index: i, votes: voteMap[i] || 0,
    }));
    return res.json({ poll, options });
  } catch (err) {
    console.error("Secretary poll results error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/polls ─────────────────────────────────────────────────

router.post("/polls", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { question, options, closes_at } = req.body || {};

    if (!question?.trim()) return res.status(400).json({ error: "question_required" });
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "at_least_two_options_required" });
    }
    const cleanOptions = options.map((o) => String(o).trim()).filter(Boolean);
    if (cleanOptions.length < 2) return res.status(400).json({ error: "at_least_two_options_required" });

    const result = await dbQuery(
      `INSERT INTO polls (society_id, question, options, closes_at)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [societyId, question.trim(), JSON.stringify(cleanOptions), closes_at ? new Date(closes_at) : null],
    );
    return res.status(201).json({ poll: result.rows[0] });
  } catch (err) {
    console.error("Secretary create poll error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/secretary/polls/:id ──────────────────────────────────────────

router.delete("/polls/:id", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `DELETE FROM polls WHERE id = $1 AND society_id = $2 RETURNING id`,
      [req.params.id, societyId],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Secretary delete poll error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SEC-104 — Society Expense Ledger & Other Income
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/secretary/expenses/summary ──────────────────────────────────────
// I&E (Income & Expenditure) statement for a given month.
// Returns: maintenance_collected, other_income_total, expenses_total,
//          surplus_deficit, expenses_by_category[], other_income_by_category[]

router.get("/expenses/summary", async (req, res) => {
  try {
    const { societyId } = req.user;
    // Default to current month
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM

    const [maintenanceRes, otherIncomeRes, expensesRes, otherIncomeCatRes] =
      await Promise.all([
        // Maintenance dues collected in this month (already tracked in maintenance_dues)
        dbQuery(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS total
           FROM maintenance_dues
           WHERE society_id = $1 AND due_month = $2 AND status = 'PAID'`,
          [societyId, month],
        ),
        // Other income total for the month
        dbQuery(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS total
           FROM society_other_income
           WHERE society_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`,
          [societyId, month],
        ),
        // Expenses by category for the month
        dbQuery(
          `SELECT category,
                  COALESCE(SUM(amount), 0)::numeric AS total,
                  COUNT(*) AS count,
                  expense_type
           FROM society_expenses
           WHERE society_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2
           GROUP BY category, expense_type
           ORDER BY total DESC`,
          [societyId, month],
        ),
        // Other income by category
        dbQuery(
          `SELECT category,
                  COALESCE(SUM(amount), 0)::numeric AS total,
                  COUNT(*) AS count
           FROM society_other_income
           WHERE society_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2
           GROUP BY category
           ORDER BY total DESC`,
          [societyId, month],
        ),
      ]);

    const maintenanceCollected = Number(maintenanceRes?.rows[0]?.total || 0);
    const otherIncomeTotal     = Number(otherIncomeRes?.rows[0]?.total || 0);
    const expensesByCategory   = expensesRes?.rows || [];
    const incomeByCat          = otherIncomeCatRes?.rows || [];

    const totalIncome    = maintenanceCollected + otherIncomeTotal;
    const totalExpenses  = expensesByCategory.reduce((s, r) => s + Number(r.total), 0);
    const surplusDeficit = totalIncome - totalExpenses;

    return res.json({
      month,
      income: {
        maintenance_collected: maintenanceCollected,
        other_income:          otherIncomeTotal,
        total:                 totalIncome,
      },
      expenses: {
        by_category: expensesByCategory,
        total:       totalExpenses,
      },
      other_income_by_category: incomeByCat,
      surplus_deficit:          surplusDeficit,
    });
  } catch (err) {
    console.error("Expenses summary error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/expenses/annual ───────────────────────────────────────
// 12-month I&E table for a given year (useful for AGM/auditor report).

router.get("/expenses/annual", async (req, res) => {
  try {
    const { societyId } = req.user;
    const year = req.query.year || new Date().getFullYear().toString();

    const [maintenanceRows, otherIncomeRows, expenseRows] = await Promise.all([
      dbQuery(
        `SELECT due_month AS month, COALESCE(SUM(amount), 0)::numeric AS total
         FROM maintenance_dues
         WHERE society_id = $1 AND due_month LIKE $2
           AND status = 'PAID'
         GROUP BY due_month
         ORDER BY due_month`,
        [societyId, `${year}-%`],
      ),
      dbQuery(
        `SELECT TO_CHAR(date, 'YYYY-MM') AS month,
                COALESCE(SUM(amount), 0)::numeric AS total
         FROM society_other_income
         WHERE society_id = $1 AND EXTRACT(YEAR FROM date) = $2
         GROUP BY month ORDER BY month`,
        [societyId, year],
      ),
      dbQuery(
        `SELECT TO_CHAR(date, 'YYYY-MM') AS month,
                COALESCE(SUM(amount), 0)::numeric AS total_expenses,
                category
         FROM society_expenses
         WHERE society_id = $1 AND EXTRACT(YEAR FROM date) = $2
         GROUP BY month, category
         ORDER BY month`,
        [societyId, year],
      ),
    ]);

    // Build month map
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      months[key] = { month: key, maintenance: 0, other_income: 0, expenses: 0, surplus: 0 };
    }
    (maintenanceRows?.rows || []).forEach((r) => {
      if (months[r.month]) months[r.month].maintenance = Number(r.total);
    });
    (otherIncomeRows?.rows || []).forEach((r) => {
      if (months[r.month]) months[r.month].other_income = Number(r.total);
    });
    (expenseRows?.rows || []).forEach((r) => {
      if (months[r.month]) months[r.month].expenses += Number(r.total_expenses);
    });
    Object.values(months).forEach((m) => {
      m.surplus = (m.maintenance + m.other_income) - m.expenses;
    });

    return res.json({ year, months: Object.values(months) });
  } catch (err) {
    console.error("Expenses annual error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/expenses ──────────────────────────────────────────────
// List expenses with optional filters: month, category, expense_type, fund_source

router.get("/expenses", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { month, category, expense_type, fund_source, limit = 200 } = req.query;

    const conditions = ["e.society_id = $1"];
    const params     = [societyId];
    let   p          = 2;

    if (month)        { conditions.push(`TO_CHAR(e.date, 'YYYY-MM') = $${p++}`); params.push(month); }
    if (category)     { conditions.push(`e.category = $${p++}`);                 params.push(category); }
    if (expense_type) { conditions.push(`e.expense_type = $${p++}`);             params.push(expense_type); }
    if (fund_source)  { conditions.push(`e.fund_source = $${p++}`);              params.push(fund_source); }

    params.push(Math.min(Number(limit), 500));

    const result = await dbQuery(
      `SELECT e.*,
              a.username AS created_by_name
       FROM society_expenses e
       LEFT JOIN auth_accounts a ON a.id = e.created_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT $${p}`,
      params,
    );

    return res.json({ expenses: result?.rows || [] });
  } catch (err) {
    console.error("List expenses error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/expenses ─────────────────────────────────────────────

router.post("/expenses", async (req, res) => {
  try {
    const { societyId, id: userId } = req.user;
    const {
      date, category, subcategory, description, amount,
      payment_mode = "BANK_TRANSFER", fund_source = "MAINTENANCE_FUND",
      expense_type = "OPEX", payee_name, reference_no, receipt_url, notes,
    } = req.body;

    if (!date)        return res.status(400).json({ error: "date_required" });
    if (!category)    return res.status(400).json({ error: "category_required" });
    if (!description) return res.status(400).json({ error: "description_required" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "invalid_amount" });

    const result = await dbQuery(
      `INSERT INTO society_expenses
         (society_id, date, category, subcategory, description, amount,
          payment_mode, fund_source, expense_type, payee_name, reference_no,
          receipt_url, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        societyId, date, category, subcategory || null, description, Number(amount),
        payment_mode, fund_source, expense_type, payee_name || null,
        reference_no || null, receipt_url || null, notes || null, userId,
      ],
    );

    return res.status(201).json({ expense: result.rows[0] });
  } catch (err) {
    console.error("Add expense error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/secretary/expenses/:id ────────────────────────────────────────

router.patch("/expenses/:id", async (req, res) => {
  try {
    const { societyId } = req.user;
    const {
      date, category, subcategory, description, amount,
      payment_mode, fund_source, expense_type,
      payee_name, reference_no, receipt_url, notes,
    } = req.body;

    if (amount !== undefined && Number(amount) <= 0)
      return res.status(400).json({ error: "invalid_amount" });

    const result = await dbQuery(
      `UPDATE society_expenses
       SET date         = COALESCE($3, date),
           category     = COALESCE($4, category),
           subcategory  = COALESCE($5, subcategory),
           description  = COALESCE($6, description),
           amount       = COALESCE($7, amount),
           payment_mode = COALESCE($8, payment_mode),
           fund_source  = COALESCE($9, fund_source),
           expense_type = COALESCE($10, expense_type),
           payee_name   = COALESCE($11, payee_name),
           reference_no = COALESCE($12, reference_no),
           receipt_url  = COALESCE($13, receipt_url),
           notes        = COALESCE($14, notes),
           updated_at   = NOW()
       WHERE id = $1 AND society_id = $2
       RETURNING *`,
      [
        req.params.id, societyId,
        date || null, category || null, subcategory || null, description || null,
        amount ? Number(amount) : null, payment_mode || null, fund_source || null,
        expense_type || null, payee_name || null, reference_no || null,
        receipt_url || null, notes || null,
      ],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error("Update expense error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/secretary/expenses/:id ───────────────────────────────────────

router.delete("/expenses/:id", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `DELETE FROM society_expenses WHERE id = $1 AND society_id = $2 RETURNING id`,
      [req.params.id, societyId],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete expense error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/secretary/other-income ──────────────────────────────────────────

router.get("/other-income", async (req, res) => {
  try {
    const { societyId } = req.user;
    const { month, limit = 200 } = req.query;

    const conditions = ["i.society_id = $1"];
    const params     = [societyId];
    let p = 2;

    if (month) { conditions.push(`TO_CHAR(i.date, 'YYYY-MM') = $${p++}`); params.push(month); }
    params.push(Math.min(Number(limit), 500));

    const result = await dbQuery(
      `SELECT i.*, a.username AS created_by_name
       FROM society_other_income i
       LEFT JOIN auth_accounts a ON a.id = i.created_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.date DESC, i.created_at DESC
       LIMIT $${p}`,
      params,
    );

    return res.json({ income: result?.rows || [] });
  } catch (err) {
    console.error("List other income error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/secretary/other-income ─────────────────────────────────────────

router.post("/other-income", async (req, res) => {
  try {
    const { societyId, id: userId } = req.user;
    const {
      date, category, description, amount,
      payer_name, reference_no, payment_mode = "BANK_TRANSFER", notes,
    } = req.body;

    if (!date)        return res.status(400).json({ error: "date_required" });
    if (!category)    return res.status(400).json({ error: "category_required" });
    if (!description) return res.status(400).json({ error: "description_required" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "invalid_amount" });

    const result = await dbQuery(
      `INSERT INTO society_other_income
         (society_id, date, category, description, amount,
          payer_name, reference_no, payment_mode, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        societyId, date, category, description, Number(amount),
        payer_name || null, reference_no || null, payment_mode, notes || null, userId,
      ],
    );

    return res.status(201).json({ income: result.rows[0] });
  } catch (err) {
    console.error("Add other income error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/secretary/other-income/:id ───────────────────────────────────

router.delete("/other-income/:id", async (req, res) => {
  try {
    const { societyId } = req.user;
    const result = await dbQuery(
      `DELETE FROM society_other_income WHERE id = $1 AND society_id = $2 RETURNING id`,
      [req.params.id, societyId],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete other income error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
