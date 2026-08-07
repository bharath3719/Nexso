/**
 * routes/guard.js
 * ───────────────
 * Guard portal authentication and pass verification.
 *
 *   POST /api/guard/login             — guard username+password → JWT
 *   GET  /api/guard/verify/:pass_code — look up a pass (requires guard JWT)
 *   POST /api/guard/passes/:id/use    — mark pass as USED (requires guard JWT)
 */

import express from "express";
import bcrypt  from "bcryptjs";
import jwt     from "jsonwebtoken";
import { dbQuery } from "../db/index.js";
import { jwtSecret as JWT_SECRET } from "../utils/secrets.js";

const router = express.Router();

const JWT_EXPIRES = "12h";

// ── Guard JWT middleware ───────────────────────────────────────────────────────

function requireGuard(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "auth_required" });

  try {
    const payload = jwt.verify(token, JWT_SECRET());
    if (payload.role !== "GUARD") {
      return res.status(403).json({ error: "guard_required" });
    }
    req.guard = {
      id:          payload.sub,
      username:    payload.username,
      societyId:   payload.societyId,
      societyName: payload.societyName,
    };
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

// ── POST /api/guard/login ─────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: "username_password_required" });
  }

  try {
    const result = await dbQuery(
      `SELECT g.id, g.password_hash, g.is_active, g.society_id, s.name AS society_name
       FROM guard_accounts g
       JOIN societies s ON s.id = g.society_id
       WHERE LOWER(g.username) = LOWER($1)
       LIMIT 1`,
      [username.trim()],
    );

    const account = result?.rows?.[0];
    if (!account) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (!account.is_active) {
      return res.status(403).json({ error: "account_inactive" });
    }

    const passwordOk = await bcrypt.compare(password, account.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const payload = {
      sub:         account.id,
      username:    username.trim(),
      role:        "GUARD",
      societyId:   account.society_id,
      societyName: account.society_name,
    };

    const token = jwt.sign(payload, JWT_SECRET(), { expiresIn: JWT_EXPIRES });

    return res.json({
      token,
      societyId:   account.society_id,
      societyName: account.society_name,
      username:    username.trim(),
    });
  } catch (err) {
    console.error("Guard login error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/guard/verify/:pass_code ─────────────────────────────────────────

router.get("/verify/:pass_code", requireGuard, async (req, res) => {
  const { pass_code } = req.params;

  if (!pass_code?.trim()) {
    return res.status(400).json({ error: "pass_code_required" });
  }

  try {
    // Auto-expire passes before lookup
    await dbQuery(
      `UPDATE visitor_passes
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE society_id = $1 AND status = 'ACTIVE' AND valid_until < NOW()`,
      [req.guard.societyId],
    );

    const result = await dbQuery(
      `SELECT
         vp.id, vp.visitor_name, vp.visitor_phone, vp.purpose, vp.vehicle,
         vp.valid_from, vp.valid_until, vp.pass_code, vp.status, vp.created_at,
         u.unit_number,
         t.name AS tower_name,
         r.name AS resident_name
       FROM visitor_passes vp
       JOIN units     u ON u.id = vp.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
       LEFT JOIN residents r ON r.id = vp.resident_id
       WHERE UPPER(vp.pass_code) = UPPER($1)
         AND vp.society_id = $2
       LIMIT 1`,
      [pass_code.trim(), req.guard.societyId],
    );

    if (!result?.rows?.length) {
      return res.status(404).json({ error: "pass_not_found" });
    }

    const pass = result.rows[0];

    // Determine if the pass is usable right now
    const now = new Date();
    const validFrom  = new Date(pass.valid_from);
    const validUntil = new Date(pass.valid_until);
    const usable = pass.status === "ACTIVE" && now >= validFrom && now <= validUntil;

    return res.json({ pass, usable });
  } catch (err) {
    console.error("Guard verify error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/guard/passes/:id/use ───────────────────────────────────────────

router.post("/passes/:id/use", requireGuard, async (req, res) => {
  const passId = parseInt(req.params.id, 10);
  if (!passId) return res.status(400).json({ error: "invalid_id" });

  try {
    const result = await dbQuery(
      `UPDATE visitor_passes
       SET status = 'USED', updated_at = NOW()
       WHERE id = $1
         AND society_id = $2
         AND status = 'ACTIVE'
         AND valid_from <= NOW()
         AND valid_until >= NOW()
       RETURNING *`,
      [passId, req.guard.societyId],
    );

    if (!result?.rows?.length) {
      return res.status(409).json({ error: "pass_not_usable" });
    }

    return res.json({ success: true, pass: result.rows[0] });
  } catch (err) {
    console.error("Guard use-pass error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
