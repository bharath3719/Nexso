import express from "express";
import bcrypt   from "bcryptjs";
import { dbQuery } from "../db/index.js";
import { VENDOR_CATEGORIES } from "../constants.js";
import { requireAdmin } from "../middleware/auth.js";

/** Strip any category value that isn't in the canonical enum. */
function sanitizeCategories(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c) => VENDOR_CATEGORIES.includes(c));
}

const router = express.Router();
router.use(requireAdmin);

// GET /api/vendors?limit=50&offset=0
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const status = req.query.status;
    let q = "SELECT * FROM vendors";
    const params = [];
    if (status) {
      params.push(status);
      q += ` WHERE verification_status = $${params.length}`;
    }
    q += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit);
    params.push(offset);
    const result = await dbQuery(q, params);
    return res.json({ vendors: result?.rows || [] });
  } catch (err) {
    console.error("List vendors error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/vendors
// Optionally creates a portal login when `username` + `password` are supplied.
router.post("/", async (req, res) => {
  try {
    const {
      name,
      code,
      whatsapp_number,
      categories,
      active,
      business_name,
      owner_name,
      phone,
      email,
      gst,
      team_size,
      emergency_availability,
      // optional portal login
      username,
      password,
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "name_required" });

    // Validate portal login fields together (both or neither)
    const wantsLogin = !!(username?.trim() || password);
    if (wantsLogin) {
      if (!username?.trim()) return res.status(400).json({ error: "username_required_with_password" });
      if (!password)         return res.status(400).json({ error: "password_required_with_username" });
      if (password.length < 6) return res.status(400).json({ error: "password_too_short" });

      // Check username is not already taken
      const existing = await dbQuery(
        "SELECT id FROM auth_accounts WHERE LOWER(username) = LOWER($1) LIMIT 1",
        [username.trim()],
      );
      if (existing?.rows?.length) {
        return res.status(409).json({ error: "username_taken" });
      }
    }

    const cats = sanitizeCategories(categories);

    // 1. Create the vendor record
    const vendorResult = await dbQuery(
      "INSERT INTO vendors (name, code, whatsapp_number, categories, active, business_name, owner_name, phone, email, gst, team_size, emergency_availability, verification_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
      [name, code || null, whatsapp_number || null, cats, active ?? true, business_name || null, owner_name || null, phone || null, email || null, gst || null, team_size || null, emergency_availability ?? false, 'VERIFICATION_PENDING'],
    );
    const vendor = vendorResult?.rows?.[0];

    // 2. Optionally create the portal auth account
    let vendorCredentials = null;
    if (wantsLogin && vendor) {
      const hash = await bcrypt.hash(password, 12);
      await dbQuery(
        `INSERT INTO auth_accounts
           (username, password_hash, portal_role, vendor_id, force_password_reset)
         VALUES ($1, $2, 'VENDOR', $3, TRUE)`,
        [username.trim(), hash, vendor.id],
      );
      vendorCredentials = { username: username.trim() };
    }

    return res.status(201).json({ vendor, vendorCredentials });
  } catch (err) {
    console.error("Create vendor error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PUT /api/vendors/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const {
      name,
      code,
      whatsapp_number,
      categories,
      active,
      business_name,
      owner_name,
      phone,
      email,
      gst,
      team_size,
      emergency_availability,
      verification_status,
    } = req.body || {};
    if (!name) return res.status(400).json({ error: "name_required" });
    const cats = sanitizeCategories(categories);
    const result = await dbQuery(
      "UPDATE vendors SET name=$1, code=$2, whatsapp_number=$3, categories=$4, active=$5, business_name=$6, owner_name=$7, phone=$8, email=$9, gst=$10, team_size=$11, emergency_availability=$12, verification_status=$13 WHERE id=$14 RETURNING *",
      [name, code || null, whatsapp_number || null, cats, active ?? true, business_name || null, owner_name || null, phone || null, email || null, gst || null, team_size || null, emergency_availability ?? false, verification_status || null, id],
    );
    if (!result?.rowCount) return res.status(404).json({ error: "not_found" });
    return res.json({ vendor: result.rows[0] });
  } catch (err) {
    console.error("Update vendor error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// DELETE /api/vendors/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const result = await dbQuery("DELETE FROM vendors WHERE id=$1", [id]);
    if (!result?.rowCount) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete vendor error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/vendors/queue/pending
router.get("/queue/pending", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const r = await dbQuery("SELECT * FROM vendors WHERE verification_status = 'VERIFICATION_PENDING' ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
    return res.json({ vendors: r?.rows || [] });
  } catch (err) {
    console.error("Pending vendors error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/vendors/:id/approve
router.post("/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const r = await dbQuery("UPDATE vendors SET verification_status='APPROVED', verified_at = NOW(), verified_by = NULL WHERE id=$1 RETURNING *", [id]);
    if (!r?.rowCount) return res.status(404).json({ error: "not_found" });
    return res.json({ vendor: r.rows[0] });
  } catch (err) {
    console.error("Approve vendor error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/vendors/:id/reject
router.post("/:id/reject", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ error: "reason_required" });
    const r = await dbQuery("UPDATE vendors SET verification_status='REJECTED', rejection_reason=$2, verified_at = NULL WHERE id=$1 RETURNING *", [id, reason]);
    if (!r?.rowCount) return res.status(404).json({ error: "not_found" });
    return res.json({ vendor: r.rows[0] });
  } catch (err) {
    console.error("Reject vendor error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/vendors/:id/suspend
router.post("/:id/suspend", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ error: "reason_required" });
    await dbQuery("INSERT INTO vendor_suspensions (vendor_id, reason, suspended_by) VALUES ($1,$2,NULL)", [id, reason]);
    const r = await dbQuery("UPDATE vendors SET verification_status='SUSPENDED' WHERE id=$1 RETURNING *", [id]);
    if (!r?.rowCount) return res.status(404).json({ error: "not_found" });
    return res.json({ vendor: r.rows[0] });
  } catch (err) {
    console.error("Suspend vendor error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/vendors/:vendorId/verification-history
router.get("/:vendorId/verification-history", async (req, res) => {
  try {
    const id = Number(req.params.vendorId);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const vendor = await dbQuery("SELECT * FROM vendors WHERE id=$1", [id]);
    const suspensions = await dbQuery("SELECT * FROM vendor_suspensions WHERE vendor_id=$1 ORDER BY suspended_at DESC", [id]);
    return res.json({ vendor: vendor?.rows?.[0] || null, suspensions: suspensions?.rows || [] });
  } catch (err) {
    console.error("Vendor history error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/vendors/:vendorId/documents
router.get("/:vendorId/documents", async (req, res) => {
  try {
    const id = Number(req.params.vendorId);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const r = await dbQuery(
      "SELECT id, vendor_id, doc_type, filename, url, metadata, uploaded_at FROM vendor_documents WHERE vendor_id=$1 ORDER BY uploaded_at DESC",
      [id],
    );
    return res.json({ documents: r?.rows || [] });
  } catch (err) {
    console.error("List vendor documents error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/vendors/:vendorId/tickets?status=OPEN&limit=50&offset=0
router.get("/:vendorId/tickets", async (req, res) => {
  try {
    const vendorId = Number(req.params.vendorId);
    if (!vendorId || Number.isNaN(vendorId)) {
      return res.status(400).json({ error: "invalid_vendor_id" });
    }

    const status = req.query.status;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const params = [vendorId];
    let where = "t.assigned_vendor_id = $1";
    if (status) {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }

    params.push(limit);
    params.push(offset);

    const q = `
      SELECT t.*, s.name AS society_name
      FROM tickets t
      LEFT JOIN societies s ON s.id = t.society_id
      WHERE ${where}
      ORDER BY t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const r = await dbQuery(q, params);
    return res.json({ tickets: r?.rows || [] });
  } catch (err) {
    console.error("List vendor tickets error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
