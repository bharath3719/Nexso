/**
 * routes/auth.js
 * ──────────────
 * Web-portal authentication endpoints.
 *
 *   POST /api/auth/login            — username + password → JWT
 *   POST /api/auth/change-password  — change own password (requires auth)
 *   GET  /api/auth/me               — return current session info (requires auth)
 *   POST /api/auth/otp/request      — send OTP to resident WhatsApp number
 *   POST /api/auth/otp/verify       — verify OTP → JWT for RESIDENT role
 */

import express   from "express";
import bcrypt    from "bcryptjs";
import jwt       from "jsonwebtoken";
import crypto    from "crypto";
import { dbQuery }          from "../db/index.js";
import { requireAuth }      from "../middleware/auth.js";
import { sendWhatsAppText } from "../services/notifications.js";

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

// ── POST /api/auth/otp/request ────────────────────────────────────────────────
// Normalise phone: strip leading + and spaces so "91XXXXXXXXXX" matches the DB.

router.post("/otp/request", async (req, res) => {
  const rawPhone = (req.body?.phone || "").trim().replace(/\s+/g, "");
  // Accept +91XXXXXXXXXX or 91XXXXXXXXXX or 10-digit; normalise to digits only.
  const phone = rawPhone.replace(/^\+/, "");

  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: "phone_required" });
  }

  try {
    // Only residents in the DB can request an OTP.
    const resResult = await dbQuery(
      `SELECT r.id, r.name, r.society_id, r.unit_id,
              u.unit_number, s.name AS society_name
       FROM residents r
       JOIN units     u ON u.id = r.unit_id
       JOIN societies s ON s.id = r.society_id
       WHERE REPLACE(r.phone, ' ', '') = $1
         AND r.unit_id IS NOT NULL
       LIMIT 1`,
      [phone],
    );

    if (!resResult?.rows?.length) {
      return res.status(404).json({ error: "phone_not_registered" });
    }

    const OTP_TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS || "300", 10);
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await dbQuery(
      `INSERT INTO otp_tokens (phone, otp_code, expires_at) VALUES ($1, $2, $3)`,
      [phone, otpCode, expiresAt],
    );

    const msgSent = await sendWhatsAppText(
      phone,
      `Your Nexso login OTP is *${otpCode}*. It expires in ${Math.round(OTP_TTL_SECONDS / 60)} minutes. Do not share it with anyone.`,
    ).catch(() => ({ skipped: true }));

    // In dev (no WA token) return OTP directly so frontend can test.
    const devMode = !process.env.WHATSAPP_TOKEN;

    return res.json({
      success: true,
      expiresAt,
      ...(devMode ? { otp: otpCode } : {}),
    });
  } catch (err) {
    console.error("OTP request error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/auth/otp/verify ─────────────────────────────────────────────────

router.post("/otp/verify", async (req, res) => {
  const rawPhone = (req.body?.phone || "").trim().replace(/\s+/g, "");
  const phone    = rawPhone.replace(/^\+/, "");
  const otp      = (req.body?.otp || "").trim();

  if (!phone || !otp) {
    return res.status(400).json({ error: "phone_and_otp_required" });
  }

  try {
    // Find the most recent unused, non-expired OTP for this phone.
    const tokenResult = await dbQuery(
      `SELECT id FROM otp_tokens
       WHERE phone = $1
         AND otp_code = $2
         AND used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone, otp],
    );

    if (!tokenResult?.rows?.length) {
      return res.status(401).json({ error: "invalid_or_expired_otp" });
    }

    const tokenId = tokenResult.rows[0].id;

    // Mark token used.
    await dbQuery(`UPDATE otp_tokens SET used = TRUE WHERE id = $1`, [tokenId]);

    // Look up the resident.
    const resResult = await dbQuery(
      `SELECT r.id AS resident_id, r.name, r.society_id, r.unit_id,
              u.unit_number, s.name AS society_name
       FROM residents r
       JOIN units     u ON u.id = r.unit_id
       JOIN societies s ON s.id = r.society_id
       WHERE REPLACE(r.phone, ' ', '') = $1
         AND r.unit_id IS NOT NULL
       LIMIT 1`,
      [phone],
    );

    const resident = resResult?.rows?.[0];
    if (!resident) {
      return res.status(404).json({ error: "resident_not_found" });
    }

    // Check if auth_account already exists for this phone.
    const existingAcc = await dbQuery(
      `SELECT id FROM auth_accounts WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [phone],
    );

    let accountId;
    if (existingAcc?.rows?.length) {
      accountId = existingAcc.rows[0].id;
      await dbQuery(
        `UPDATE auth_accounts SET last_login = NOW(), resident_id = $1, society_id = $2 WHERE id = $3`,
        [resident.resident_id, resident.society_id, accountId],
      );
    } else {
      const newAcc = await dbQuery(
        `INSERT INTO auth_accounts (username, password_hash, portal_role, society_id, resident_id, force_password_reset)
         VALUES ($1, $2, 'RESIDENT', $3, $4, FALSE)
         RETURNING id`,
        [phone, await bcrypt.hash(crypto.randomUUID(), 4), resident.society_id, resident.resident_id],
      );
      accountId = newAcc.rows[0].id;
    }

    const payload = {
      sub:          accountId,
      username:     phone,
      role:         "RESIDENT",
      societyId:    resident.society_id,
      societyName:  resident.society_name,
      residentId:   resident.resident_id,
      unitId:       resident.unit_id,
      unitNumber:   resident.unit_number,
    };

    const token = jwt.sign(payload, JWT_SECRET(), { expiresIn: JWT_EXPIRES });

    return res.json({
      token,
      portalRole:   "RESIDENT",
      societyId:    resident.society_id,
      societyName:  resident.society_name,
      residentId:   resident.resident_id,
      unitId:       resident.unit_id,
      unitNumber:   resident.unit_number,
      name:         resident.name,
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
