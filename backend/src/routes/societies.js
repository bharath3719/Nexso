import express from "express";
import { dbQuery } from "../db/index.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAdmin);

// GET /api/societies?limit=100&offset=0
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const offset = Number(req.query.offset) || 0;
    const result = await dbQuery("SELECT * FROM societies ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);
    return res.json({ societies: result?.rows || [] });
  } catch (err) {
    console.error("List societies error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/societies
router.post("/", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name_required" });
    const result = await dbQuery("INSERT INTO societies (name) VALUES ($1) RETURNING *", [name]);
    return res.status(201).json({ society: result?.rows?.[0] });
  } catch (err) {
    console.error("Create society error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
