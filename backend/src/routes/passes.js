/**
 * routes/passes.js
 * ─────────────────
 * Public (unauthenticated) visitor pass lookup.
 * Returns only safe display fields — no PII like phone or resident_id.
 *
 *   GET /api/passes/:pass_code
 */

import express from "express";
import { dbQuery } from "../db/index.js";

const router = express.Router();

// ── GET /api/passes/:pass_code ────────────────────────────────────────────────

router.get("/:pass_code", async (req, res) => {
  const { pass_code } = req.params;

  if (!pass_code?.trim()) {
    return res.status(400).json({ error: "pass_code_required" });
  }

  try {
    // Auto-expire before returning
    await dbQuery(
      `UPDATE visitor_passes
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE pass_code = UPPER($1) AND status = 'ACTIVE' AND valid_until < NOW()`,
      [pass_code.trim()],
    );

    const result = await dbQuery(
      `SELECT
         vp.id, vp.visitor_name, vp.purpose, vp.vehicle,
         vp.valid_from, vp.valid_until, vp.pass_code, vp.status,
         u.unit_number,
         t.name  AS tower_name,
         s.name  AS society_name,
         s.address AS society_address
       FROM visitor_passes vp
       JOIN units     u ON u.id = vp.unit_id
       JOIN societies s ON s.id = vp.society_id
       LEFT JOIN towers t ON t.id = u.tower_id
       WHERE UPPER(vp.pass_code) = UPPER($1)
       LIMIT 1`,
      [pass_code.trim()],
    );

    if (!result?.rows?.length) {
      return res.status(404).json({ error: "pass_not_found" });
    }

    return res.json({ pass: result.rows[0] });
  } catch (err) {
    console.error("Public pass lookup error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
