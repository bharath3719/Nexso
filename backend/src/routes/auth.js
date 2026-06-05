/**
 * routes/auth.js
 * ──────────────
 * Web-portal authentication endpoints.
 *
 *   POST /api/auth/login            — username + password → JWT
 *   POST /api/auth/change-password  — change own password (requires auth)
 *   GET  /api/auth/me               — return current session info (requires auth)
 */

import express from "express";
import bcrypt  from "bcryptjs";
import jwt     from "jsonwebtoken";
import { dbQuery } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const JWT_SECRET  = () => process.env.JWT_SECRET || "nexso-dev-secret";
const JWT_EXPIRES = "7d";

// ── POST /api/auth/login ───────────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: "username_password_required" });
  }

  try {
    const result = await dbQuery(
      `SELECT a.*, s.name AS society_name
       FROM auth_accounts a
       LEFT JOIN societies s ON s.id = a.society_id
       WHERE LOWER(a.username) = LOWER($1)
       LIMIT 1`,
      [username.trim()],
    );

    const account = result?.rows?.[0];
    if (!account) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const passwordOk = await bcrypt.compare(password, account.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    // Update last_login
    await dbQuery(
      `UPDATE auth_accounts SET last_login = NOW() WHERE id = $1`,
      [account.id],
    );

    const payload = {
      sub:        account.id,
      username:   account.username,
      role:       account.portal_role,
      societyId:  account.society_id,
      societyName: account.society_name || null,
      vendorId:   account.vendor_id || null,
    };

    const token = jwt.sign(payload, JWT_SECRET(), { expiresIn: JWT_EXPIRES });

    return res.json({
      token,
      portalRole:          account.portal_role,
      societyId:           account.society_id,
      societyName:         account.society_name || null,
      forcePasswordReset:  account.force_password_reset,
      username:            account.username,
      vendorId:            account.vendor_id || null,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/auth/change-password ────────────────────────────────────────────

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "both_passwords_required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "password_too_short" });
  }

  try {
    const result = await dbQuery(
      `SELECT password_hash FROM auth_accounts WHERE id = $1`,
      [req.user.id],
    );

    const account = result?.rows?.[0];
    if (!account) return res.status(404).json({ error: "account_not_found" });

    const currentOk = await bcrypt.compare(currentPassword, account.password_hash);
    if (!currentOk) return res.status(401).json({ error: "current_password_wrong" });

    const newHash = await bcrypt.hash(newPassword, 12);

    await dbQuery(
      `UPDATE auth_accounts
       SET password_hash = $1, force_password_reset = FALSE
       WHERE id = $2`,
      [newHash, req.user.id],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Change-password error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT a.id, a.username, a.portal_role, a.force_password_reset,
              a.last_login, a.society_id, s.name AS society_name,
              s.building_id, s.address, s.society_type
       FROM auth_accounts a
       LEFT JOIN societies s ON s.id = a.society_id
       WHERE a.id = $1`,
      [req.user.id],
    );

    const account = result?.rows?.[0];
    if (!account) return res.status(404).json({ error: "account_not_found" });

    return res.json({ account });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
