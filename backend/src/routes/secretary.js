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
import { createPaymentLink, isRazorpayConfigured } from "../services/razorpayService.js";

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
             ms.enabled  AS maintenance_enabled,
             ms.amount   AS maintenance_amount,
             ms.due_day  AS maintenance_due_day
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
    const occupancyCheck = await dbQuery(
      `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 LIMIT 1`,
      [unit_id, normalizedType],
    );
    if (occupancyCheck?.rows?.length) {
      return res.status(409).json({
        error: "occupancy_conflict",
        message: `This unit already has an ${normalizedType}. Remove the existing ${normalizedType} before adding a new one.`,
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
    if (maintenance_enabled || maintenance_amount || maintenance_due_day) {
      await dbQuery(
        `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (unit_id) DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           amount     = EXCLUDED.amount,
           due_day    = EXCLUDED.due_day,
           updated_at = NOW()`,
        [
          unit_id,
          societyId,
          !!maintenance_enabled,
          maintenance_amount  ? Number(maintenance_amount)  : null,
          maintenance_due_day ? Number(maintenance_due_day) : null,
        ],
      );
    }

    // Read back unit-level maintenance settings for the response
    const msRes = await dbQuery(
      `SELECT enabled AS maintenance_enabled, amount AS maintenance_amount, due_day AS maintenance_due_day
       FROM maintenance_settings WHERE unit_id = $1`,
      [unit_id],
    );
    const ms = msRes?.rows?.[0] || {};

    return res.status(201).json({
      resident: {
        ...resident,
        unit_number:          unitCheck.rows[0].unit_number,
        tower_name:           unitCheck.rows[0].tower_name  || null,
        maintenance_enabled:  ms.maintenance_enabled  ?? false,
        maintenance_amount:   ms.maintenance_amount   ?? null,
        maintenance_due_day:  ms.maintenance_due_day  ?? null,
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
  } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: "name_required" });

  try {
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

    // If resident_type changed, ensure the new type slot isn't already taken by someone else
    if (resident_type) {
      const normalizedType = resident_type.toUpperCase();
      const conflict = await dbQuery(
        `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 AND id <> $3 LIMIT 1`,
        [resident.unit_id, normalizedType, residentId],
      );
      if (conflict?.rows?.length) {
        return res.status(409).json({
          error: "occupancy_conflict",
          message: `This unit already has an ${normalizedType}. Remove the existing ${normalizedType} before reassigning.`,
        });
      }
    }

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
    if (maintenance_enabled !== undefined || maintenance_amount !== undefined || maintenance_due_day !== undefined) {
      await dbQuery(
        `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (unit_id) DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           amount     = EXCLUDED.amount,
           due_day    = EXCLUDED.due_day,
           updated_at = NOW()`,
        [
          resident.unit_id,
          societyId,
          !!maintenance_enabled,
          maintenance_amount  ? Number(maintenance_amount)  : null,
          maintenance_due_day ? Number(maintenance_due_day) : null,
        ],
      );
    }

    // Fetch the current unit-level maintenance settings
    const msRes = await dbQuery(
      `SELECT enabled AS maintenance_enabled, amount AS maintenance_amount, due_day AS maintenance_due_day
       FROM maintenance_settings WHERE unit_id = $1`,
      [resident.unit_id],
    );
    const ms = msRes?.rows?.[0] || {};

    return res.json({
      resident: {
        ...resident,
        unit_number:         unitRes.rows[0]?.unit_number,
        tower_name:          unitRes.rows[0]?.tower_name || null,
        maintenance_enabled: ms.maintenance_enabled ?? false,
        maintenance_amount:  ms.maintenance_amount  ?? null,
        maintenance_due_day: ms.maintenance_due_day ?? null,
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

    const VALID = ["PENDING", "PAID", "OVERDUE", "WAIVED"];
    if (status && !VALID.includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
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

// ── POST /api/secretary/maintenance/generate ──────────────────────────────────
// Generates dues for the current (or specified) month for all enabled residents.

router.post("/maintenance/generate", async (req, res) => {
  try {
    const societyId   = req.user.societyId;
    const { month }   = req.body || {};
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [year, mon] = targetMonth.split("-").map(Number);

    const settings = await dbQuery(
      `SELECT unit_id, amount, due_day FROM maintenance_settings
       WHERE society_id = $1 AND enabled = TRUE
         AND amount IS NOT NULL AND amount > 0
         AND due_day IS NOT NULL`,
      [societyId],
    );

    if (!settings?.rows?.length) {
      return res.json({ created: 0, skipped: 0, message: "No active maintenance settings found." });
    }

    // Fetch society name for Razorpay link description
    const socRes = await dbQuery(
      `SELECT name FROM societies WHERE id = $1`, [societyId],
    );
    const societyName = socRes?.rows?.[0]?.name || "Society";
    const rzpEnabled  = isRazorpayConfigured();

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
      // Current occupant: TENANT first, else OWNER
      const occupantRes = await dbQuery(
        `SELECT id, name, phone, email FROM residents
         WHERE unit_id = $1
         ORDER BY CASE WHEN resident_type = 'TENANT' THEN 0 ELSE 1 END
         LIMIT 1`,
        [s.unit_id],
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

      // Create Razorpay payment link if configured
      if (rzpEnabled) {
        const link = await createPaymentLink({
          dueId, societyId, residentId: occupant.id,
          residentName:  occupant.name  || "Resident",
          residentEmail: occupant.email || null,
          residentPhone: occupant.phone || null,
          amount:     totalAmount,
          dueMonth:   targetMonth,
          dueDate:    dueDateStr,
          societyName,
        });
        if (link) {
          await dbQuery(
            `UPDATE maintenance_dues
             SET razorpay_payment_link_id = $1, payment_link = $2
             WHERE id = $3`,
            [link.id, link.short_url, dueId],
          );
        }
      }
    }

    return res.json({ created, skipped, month: targetMonth, razorpay: rzpEnabled });
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
    const { maintenance_enabled, maintenance_upi_id } = req.body || {};

    const result = await dbQuery(
      `UPDATE societies SET
         maintenance_enabled = COALESCE($1, maintenance_enabled),
         maintenance_upi_id  = COALESCE($2, maintenance_upi_id)
       WHERE id = $3
       RETURNING id, maintenance_enabled, maintenance_upi_id`,
      [
        maintenance_enabled != null ? !!maintenance_enabled : null,
        maintenance_upi_id  != null ? maintenance_upi_id    : null,
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

export default router;
