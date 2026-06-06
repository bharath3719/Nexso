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
 */

import express from "express";
import crypto  from "crypto";
import { dbQuery }        from "../db/index.js";
import { requireResident } from "../middleware/auth.js";

const router = express.Router();

router.use(requireResident);

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

export default router;
