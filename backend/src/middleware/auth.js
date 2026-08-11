/**
 * middleware/auth.js
 * ──────────────────
 * Validates the JWT from the Authorization header and attaches
 * req.user = { id, username, role, societyId, vendorId } to every protected route.
 *
 * Usage:
 *   import { requireAuth, requireAdmin, requireSecretary, requireVendor } from "../middleware/auth.js";
 *   router.get("/me",             requireAuth,      handler);
 *   router.get("/admin-only",     requireAdmin,     handler);
 *   router.get("/secretary-only", requireSecretary, handler);
 *   router.get("/vendor-only",    requireVendor,    handler);
 */

import jwt from "jsonwebtoken";
import { jwtSecret as JWT_SECRET } from "../utils/secrets.js";

// ── Core validator ─────────────────────────────────────────────────────────────

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "auth_required" });

  try {
    const payload = jwt.verify(token, JWT_SECRET());
    req.user = {
      id:         payload.sub,
      username:   payload.username,
      role:       payload.role,        // 'NEXSO_ADMIN' | 'SOCIETY_ADMIN' | 'VENDOR' | 'RESIDENT'
      societyId:  payload.societyId,   // null for NEXSO_ADMIN and VENDOR
      vendorId:   payload.vendorId    || null,
      residentId: payload.residentId  || null,
      unitId:     payload.unitId      || null,
      unitNumber: payload.unitNumber  || null,
    };
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

// ── Role guards ────────────────────────────────────────────────────────────────

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "NEXSO_ADMIN") {
      return res.status(403).json({ error: "admin_required" });
    }
    next();
  });
}

export function requireSecretary(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "SOCIETY_ADMIN") {
      return res.status(403).json({ error: "secretary_required" });
    }
    next();
  });
}

export function requireVendor(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "VENDOR") {
      return res.status(403).json({ error: "vendor_required" });
    }
    if (!req.user.vendorId) {
      return res.status(403).json({ error: "vendor_id_missing" });
    }
    next();
  });
}

export function requireResident(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "RESIDENT") {
      return res.status(403).json({ error: "resident_required" });
    }
    if (!req.user.residentId || !req.user.unitId) {
      return res.status(403).json({ error: "resident_mapping_missing" });
    }
    next();
  });
}
