import express from "express";
import { dbQuery } from "../db/index.js";

const router = express.Router();

// GET /api/vendors?limit=50&offset=0
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const result = await dbQuery("SELECT * FROM vendors ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
    return res.json({ vendors: result?.rows || [] });
  } catch (err) {
    console.error("List vendors error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/vendors
router.post("/", async (req, res) => {
  try {
    const { name, code, whatsapp_number, categories, active } = req.body || {};
    if (!name) return res.status(400).json({ error: "name_required" });
    const cats = Array.isArray(categories) ? categories : [];
    const result = await dbQuery("INSERT INTO vendors (name, code, whatsapp_number, categories, active) VALUES ($1,$2,$3,$4,$5) RETURNING *", [name, code || null, whatsapp_number || null, cats, active ?? true]);
    return res.status(201).json({ vendor: result?.rows?.[0] });
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
    const { name, code, whatsapp_number, categories, active } = req.body || {};
    if (!name) return res.status(400).json({ error: "name_required" });
    const cats = Array.isArray(categories) ? categories : [];
    const result = await dbQuery("UPDATE vendors SET name=$1, code=$2, whatsapp_number=$3, categories=$4, active=$5 WHERE id=$6 RETURNING *", [name, code || null, whatsapp_number || null, cats, active ?? true, id]);
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
