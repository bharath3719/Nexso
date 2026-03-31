import express from "express";
import { dbQuery } from "../db/index.js";

const router = express.Router();

// GET /api/users?limit=50&offset=0
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const result = await dbQuery("SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]);

    return res.json({ users: result?.rows || [] });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
