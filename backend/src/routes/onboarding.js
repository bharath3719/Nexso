import express from "express";
import bcrypt  from "bcryptjs";
import crypto  from "crypto";
import { dbQuery } from "../db/index.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAdmin);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick `n` chars from `chars` using a CSPRNG. */
function randomFrom(chars, n) {
  let out = "";
  for (let i = 0; i < n; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

function genBuildingId() {
  return `BLD-${randomFrom("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)}`;
}

function genTempPassword() {
  // 10-char mix of letters + digits, easy to type. Math.random() is not a
  // CSPRNG — its output is predictable, and this password is the initial
  // credential for a society admin account.
  return `Nx@${randomFrom("abcdefghjkmnpqrstuvwxyz23456789", 7)}`;
}

const RESIDENT_TYPES = ["OWNER", "TENANT"];

// ── GET /api/onboarding/societies ─────────────────────────────────────────────
// List all societies with unit + resident counts
router.get("/societies", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT
         s.*,
         COALESCE(u.unit_count, 0)     AS unit_count,
         COALESCE(r.resident_count, 0) AS resident_count
       FROM societies s
       LEFT JOIN (
         SELECT society_id, COUNT(*) AS unit_count FROM units GROUP BY society_id
       ) u ON u.society_id = s.id
       LEFT JOIN (
         SELECT society_id, COUNT(*) AS resident_count FROM residents GROUP BY society_id
       ) r ON r.society_id = s.id
       ORDER BY s.created_at DESC`,
    );
    return res.json({ societies: result?.rows || [] });
  } catch (err) {
    console.error("List onboarding societies error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/onboarding/societies ────────────────────────────────────────────
// Step 1: Create building entry
router.post("/societies", async (req, res) => {
  try {
    const {
      name,
      address,
      society_type = "APARTMENT",
      num_towers = 1,
      num_floors = 1,
      num_units = 0,
      contact_person,
      contact_phone,
      contact_email,
    } = req.body || {};

    if (!name?.trim()) return res.status(400).json({ error: "name_required" });

    const building_id   = genBuildingId();
    const tempPassword  = genTempPassword();
    const passwordHash  = await bcrypt.hash(tempPassword, 12);

    const result = await dbQuery(
      `INSERT INTO societies
         (name, address, society_type, num_towers, num_floors, num_units,
          contact_person, contact_phone, contact_email, building_id, onboarding_step)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
       RETURNING *`,
      [
        name.trim(),
        address || null,
        society_type,
        Number(num_towers) || 1,
        Number(num_floors) || 1,
        Number(num_units) || 0,
        contact_person || null,
        contact_phone || null,
        contact_email || null,
        building_id,
      ],
    );

    const society = result?.rows?.[0];

    // Auto-create secretary auth account (username = building_id)
    try {
      await dbQuery(
        `INSERT INTO auth_accounts
           (username, password_hash, portal_role, society_id, force_password_reset)
         VALUES ($1, $2, 'SOCIETY_ADMIN', $3, TRUE)
         ON CONFLICT (username) DO NOTHING`,
        [building_id, passwordHash, society.id],
      );
    } catch (authErr) {
      // Non-fatal — log but don't fail the society creation
      console.error("Auth account creation warning:", authErr.message);
    }

    return res.status(201).json({
      society,
      secretaryCredentials: {
        username:      building_id,
        tempPassword,
        note: "Share with the society secretary. Password must be changed on first login.",
      },
    });
  } catch (err) {
    console.error("Create society error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/onboarding/societies/:id ─────────────────────────────────────────
// Get society detail with full tower/floor/unit structure
router.get("/societies/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const socResult = await dbQuery("SELECT * FROM societies WHERE id = $1", [id]);
    if (!socResult?.rows?.length) return res.status(404).json({ error: "not_found" });

    const towersResult = await dbQuery(
      "SELECT * FROM towers WHERE society_id = $1 ORDER BY name",
      [id],
    );
    const towers = towersResult?.rows || [];

    for (const tower of towers) {
      const floorsResult = await dbQuery(
        "SELECT * FROM floors WHERE tower_id = $1 ORDER BY floor_number",
        [tower.id],
      );
      tower.floors = floorsResult?.rows || [];
      for (const floor of tower.floors) {
        const unitsResult = await dbQuery(
          "SELECT * FROM units WHERE floor_id = $1 ORDER BY unit_number",
          [floor.id],
        );
        floor.units = unitsResult?.rows || [];
      }
    }

    return res.json({ society: socResult.rows[0], towers });
  } catch (err) {
    console.error("Get society error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/onboarding/societies/:id ───────────────────────────────────────
// Update basic society details
router.patch("/societies/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      society_type,
      num_towers,
      num_floors,
      num_units,
      contact_person,
      contact_phone,
      contact_email,
    } = req.body || {};

    const result = await dbQuery(
      `UPDATE societies SET
         name           = COALESCE($1, name),
         address        = COALESCE($2, address),
         society_type   = COALESCE($3, society_type),
         num_towers     = COALESCE($4, num_towers),
         num_floors     = COALESCE($5, num_floors),
         num_units      = COALESCE($6, num_units),
         contact_person = COALESCE($7, contact_person),
         contact_phone  = COALESCE($8, contact_phone),
         contact_email  = COALESCE($9, contact_email)
       WHERE id = $10
       RETURNING *`,
      [
        name || null,
        address || null,
        society_type || null,
        num_towers ? Number(num_towers) : null,
        num_floors ? Number(num_floors) : null,
        num_units ? Number(num_units) : null,
        contact_person || null,
        contact_phone || null,
        contact_email || null,
        id,
      ],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ society: result.rows[0] });
  } catch (err) {
    console.error("Update society error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/onboarding/societies/:id/structure ──────────────────────────────
// Step 2: Save tower → floor → unit hierarchy
router.post("/societies/:id/structure", async (req, res) => {
  const { id } = req.params;
  const { towers } = req.body || {};

  if (!Array.isArray(towers) || towers.length === 0) {
    return res.status(400).json({ error: "towers_required" });
  }

  const db = (await import("../db/index.js")).getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Remove existing structure so re-saves are idempotent
    await client.query("DELETE FROM towers WHERE society_id = $1", [id]);

    let totalUnits = 0;

    for (const tower of towers) {
      const towerRes = await client.query(
        `INSERT INTO towers (society_id, name, num_floors) VALUES ($1,$2,$3) RETURNING id`,
        [id, tower.name, tower.floors?.length || 1],
      );
      const towerId = towerRes.rows[0].id;

      for (const floor of tower.floors || []) {
        const floorRes = await client.query(
          `INSERT INTO floors (tower_id, society_id, floor_number) VALUES ($1,$2,$3) RETURNING id`,
          [towerId, id, floor.floor_number],
        );
        const floorId = floorRes.rows[0].id;

        for (const unitNum of floor.units || []) {
          await client.query(
            `INSERT INTO units (floor_id, tower_id, society_id, unit_number) VALUES ($1,$2,$3,$4)`,
            [floorId, towerId, id, String(unitNum).trim()],
          );
          totalUnits++;
        }
      }
    }

    // Update society metadata
    await client.query(
      `UPDATE societies SET onboarding_step = GREATEST(onboarding_step, 2), num_units = $1 WHERE id = $2`,
      [totalUnits, id],
    );

    await client.query("COMMIT");

    return res.json({ success: true, total_units: totalUnits });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Save structure error:", err);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    client.release();
  }
});

// ── GET /api/onboarding/societies/:id/residents ───────────────────────────────
router.get("/societies/:id/residents", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbQuery(
      `SELECT r.*, u.unit_number,
              ms.enabled  AS maintenance_enabled,
              ms.amount   AS maintenance_amount,
              ms.due_day  AS maintenance_due_day
       FROM residents r
       JOIN units u ON u.id = r.unit_id
       LEFT JOIN maintenance_settings ms ON ms.unit_id = r.unit_id
       WHERE r.society_id = $1
       ORDER BY u.unit_number, r.name`,
      [id],
    );
    return res.json({ residents: result?.rows || [] });
  } catch (err) {
    console.error("List residents error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/onboarding/societies/:id/residents ──────────────────────────────
// Step 3: Bulk import residents
router.post("/societies/:id/residents", async (req, res) => {
  const { id } = req.params;
  const { residents } = req.body || {};

  if (!Array.isArray(residents) || residents.length === 0) {
    return res.status(400).json({ error: "residents_required" });
  }

  const db = (await import("../db/index.js")).getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    let imported = 0;
    const errors = [];

    for (const r of residents) {
      if (!r.name?.trim()) {
        errors.push({ unit: r.unit_number, reason: "name_required" });
        continue;
      }

      // Look up unit in this society.
      // When a tower name is provided, use it to disambiguate units that share
      // the same unit_number across different towers (e.g. two towers both
      // have unit "101"). Fall back to a society-wide search if the
      // tower-scoped lookup finds nothing (handles legacy/single-tower data).
      const unitNum   = String(r.unit_number || "").trim();
      const towerName = String(r.tower        || "").trim();

      let unitRes;
      if (towerName) {
        unitRes = await client.query(
          `SELECT u.id
             FROM units u
             JOIN towers t ON t.id = u.tower_id
            WHERE u.society_id    = $1
              AND LOWER(u.unit_number) = LOWER($2)
              AND LOWER(t.name)        = LOWER($3)
            LIMIT 1`,
          [id, unitNum, towerName],
        );
        // Fallback: tower name mismatch or legacy upload without tower column
        if (!unitRes.rows.length) {
          unitRes = await client.query(
            `SELECT id FROM units WHERE society_id = $1 AND LOWER(unit_number) = LOWER($2) LIMIT 1`,
            [id, unitNum],
          );
        }
      } else {
        unitRes = await client.query(
          `SELECT id FROM units WHERE society_id = $1 AND LOWER(unit_number) = LOWER($2) LIMIT 1`,
          [id, unitNum],
        );
      }

      if (!unitRes.rows.length) {
        errors.push({ unit: r.unit_number, reason: "unit_not_found" });
        continue;
      }

      const unitId = unitRes.rows[0].id;
      const normalizedType = (r.resident_type || "OWNER").toUpperCase();
      // The unit-occupancy indexes only cover OWNER/TENANT, so anything else
      // slips past the one-per-unit rule entirely.
      if (!RESIDENT_TYPES.includes(normalizedType)) {
        errors.push({ unit: r.unit_number, reason: "invalid_resident_type" });
        continue;
      }

      // One OWNER + one TENANT per unit
      const occupancyCheck = await client.query(
        `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 LIMIT 1`,
        [unitId, normalizedType],
      );
      if (occupancyCheck.rows.length) {
        errors.push({ unit: r.unit_number, reason: `unit_already_has_${normalizedType.toLowerCase()}` });
        continue;
      }

      const resResult = await client.query(
        `INSERT INTO residents
           (unit_id, society_id, name, phone, email, aadhar_number, preferred_contact,
            bhk, resident_type, family_members, invitation_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')
         RETURNING id`,
        [
          unitId,
          id,
          r.name.trim(),
          r.phone || null,
          r.email || null,
          r.aadhar_number || null,
          r.preferred_contact || "WHATSAPP",
          r.bhk || null,
          normalizedType,
          Number(r.family_members) || 0,
        ],
      );

      // Upsert unit-level maintenance settings when provided via the Excel template
      // Accept boolean true or "YES"/"yes"/"1" string from the spreadsheet
      const rawEnabled = String(r.maintenance_enabled ?? "").toUpperCase();
      const maintEnabled = r.maintenance_enabled === true
        || rawEnabled === "YES" || rawEnabled === "TRUE" || rawEnabled === "1";

      if (maintEnabled || r.maintenance_amount || r.maintenance_due_day) {
        await client.query(
          `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (unit_id) DO UPDATE SET
             enabled    = EXCLUDED.enabled,
             amount     = EXCLUDED.amount,
             due_day    = EXCLUDED.due_day,
             updated_at = NOW()`,
          [
            unitId,
            id,
            maintEnabled,
            r.maintenance_amount  ? Number(r.maintenance_amount)  : null,
            r.maintenance_due_day ? Number(r.maintenance_due_day) : null,
          ],
        );
      }

      imported++;
    }

    // Advance onboarding step to 3
    await client.query(
      `UPDATE societies SET onboarding_step = GREATEST(onboarding_step, 3) WHERE id = $1`,
      [id],
    );

    await client.query("COMMIT");

    return res.json({ success: true, imported, errors });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import residents error:", err);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    client.release();
  }
});

// ── POST /api/onboarding/societies/:id/units/:unitId/residents ────────────────
// Add a single resident directly to a known unit (used from Society Detail view)
router.post("/societies/:id/units/:unitId/residents", async (req, res) => {
  const { id, unitId } = req.params;
  const {
    name,
    phone,
    email,
    aadhar_number,
    preferred_contact = "WHATSAPP",
    bhk,
    resident_type = "OWNER",
    family_members = 0,
    // Maintenance
    maintenance_enabled = false,
    maintenance_amount,
    maintenance_due_day,
  } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: "name_required" });

  try {
    // Verify unit belongs to this society
    const unitCheck = await dbQuery(
      `SELECT id, unit_number FROM units WHERE id = $1 AND society_id = $2`,
      [unitId, id],
    );
    if (!unitCheck?.rows?.length) return res.status(404).json({ error: "unit_not_found" });

    // One OWNER + one TENANT per unit
    const normalizedType = (resident_type || "OWNER").toUpperCase();
    if (!RESIDENT_TYPES.includes(normalizedType)) {
      return res.status(400).json({ error: "invalid_resident_type", message: "resident_type must be OWNER or TENANT." });
    }
    const occupancyCheck = await dbQuery(
      `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 LIMIT 1`,
      [unitId, normalizedType],
    );
    if (occupancyCheck?.rows?.length) {
      return res.status(409).json({
        error: "occupancy_conflict",
        message: `This unit already has an ${normalizedType}. Remove the existing ${normalizedType} before adding a new one.`,
      });
    }

    const result = await dbQuery(
      `INSERT INTO residents
         (unit_id, society_id, name, phone, email, aadhar_number, preferred_contact,
          bhk, resident_type, family_members, invitation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')
       RETURNING *`,
      [
        unitId,
        id,
        name.trim(),
        phone || null,
        email || null,
        aadhar_number || null,
        preferred_contact,
        bhk || null,
        normalizedType,
        Number(family_members) || 0,
      ],
    );

    const resident = result.rows[0];

    // Upsert unit-level maintenance settings if provided
    if (maintenance_enabled || maintenance_amount || maintenance_due_day) {
      await dbQuery(
        `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (unit_id) DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           amount     = EXCLUDED.amount,
           due_day    = EXCLUDED.due_day,
           updated_at = NOW()`,
        [
          unitId,
          id,
          !!maintenance_enabled,
          maintenance_amount  ? Number(maintenance_amount)  : null,
          maintenance_due_day ? Number(maintenance_due_day) : null,
        ],
      );
    }

    // Read back unit-level settings for the response
    const msRes = await dbQuery(
      `SELECT enabled AS maintenance_enabled, amount AS maintenance_amount, due_day AS maintenance_due_day
       FROM maintenance_settings WHERE unit_id = $1`,
      [unitId],
    );
    const ms = msRes?.rows?.[0] || {};

    // Advance onboarding step
    await dbQuery(
      `UPDATE societies SET onboarding_step = GREATEST(onboarding_step, 3) WHERE id = $1`,
      [id],
    );

    return res.status(201).json({
      resident: {
        ...resident,
        unit_number:         unitCheck.rows[0].unit_number,
        maintenance_enabled: ms.maintenance_enabled  ?? false,
        maintenance_amount:  ms.maintenance_amount   ?? null,
        maintenance_due_day: ms.maintenance_due_day  ?? null,
      },
    });
  } catch (err) {
    console.error("Add single resident error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/onboarding/societies/:id/residents/:residentId ─────────────────
// Edit a single resident's details
router.patch("/societies/:id/residents/:residentId", async (req, res) => {
  const { id, residentId } = req.params;
  const {
    name, phone, email, aadhar_number,
    preferred_contact, bhk, resident_type, family_members,
    // Maintenance
    maintenance_enabled,
    maintenance_amount,
    maintenance_due_day,
  } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ error: "name_required" });
  if (!phone?.trim()) return res.status(400).json({ error: "phone_required" });

  const normalizedType = (resident_type || "OWNER").toUpperCase();
  if (!RESIDENT_TYPES.includes(normalizedType)) {
    return res.status(400).json({ error: "invalid_resident_type", message: "resident_type must be OWNER or TENANT." });
  }

  try {
    const currentRes = await dbQuery(
      `SELECT id, unit_id FROM residents WHERE id = $1 AND society_id = $2`,
      [residentId, id],
    );
    if (!currentRes?.rows?.length) return res.status(404).json({ error: "not_found" });

    // Check occupancy BEFORE writing. Running this after the UPDATE (as it used
    // to) never fired: the partial unique index rejects the write first, so a
    // genuine conflict surfaced as a 500 instead of this 409.
    const unitId = currentRes.rows[0].unit_id;
    if (unitId) {
      const conflict = await dbQuery(
        `SELECT id FROM residents WHERE unit_id = $1 AND resident_type = $2 AND id <> $3 LIMIT 1`,
        [unitId, normalizedType, residentId],
      );
      if (conflict?.rows?.length) {
        return res.status(409).json({
          error: "occupancy_conflict",
          message: `This unit already has an ${normalizedType}. Remove the existing ${normalizedType} before reassigning.`,
        });
      }
    }

    const result = await dbQuery(
      `UPDATE residents SET
         name              = $1,
         phone             = $2,
         email             = $3,
         aadhar_number     = $4,
         preferred_contact = $5,
         bhk               = $6,
         resident_type     = $7,
         family_members    = $8
       WHERE id = $9 AND society_id = $10
       RETURNING *`,
      [
        name.trim(),
        phone.trim(),
        email || null,
        aadhar_number || null,
        preferred_contact || "WHATSAPP",
        bhk || null,
        normalizedType,
        Number(family_members) || 0,
        residentId,
        id,
      ],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });

    const resident = result.rows[0];

    // Upsert unit-level maintenance settings when field is explicitly sent
    if (maintenance_enabled !== undefined || maintenance_amount !== undefined || maintenance_due_day !== undefined) {
      await dbQuery(
        `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (unit_id) DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           amount     = EXCLUDED.amount,
           due_day    = EXCLUDED.due_day,
           updated_at = NOW()`,
        [
          resident.unit_id,
          id,
          !!maintenance_enabled,
          maintenance_amount  ? Number(maintenance_amount)  : null,
          maintenance_due_day ? Number(maintenance_due_day) : null,
        ],
      );
    }

    // Fetch unit_number and current unit-level maintenance settings
    const [unitRes, msRes] = await Promise.all([
      dbQuery(`SELECT unit_number FROM units WHERE id = $1`, [resident.unit_id]),
      dbQuery(`SELECT enabled AS maintenance_enabled, amount AS maintenance_amount, due_day AS maintenance_due_day
               FROM maintenance_settings WHERE unit_id = $1`, [resident.unit_id]),
    ]);

    const ms = msRes?.rows?.[0] || {};

    return res.json({
      resident: {
        ...resident,
        unit_number:         unitRes.rows[0]?.unit_number,
        maintenance_enabled: ms.maintenance_enabled ?? false,
        maintenance_amount:  ms.maintenance_amount  ?? null,
        maintenance_due_day: ms.maintenance_due_day ?? null,
      },
    });
  } catch (err) {
    console.error("Update resident error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/onboarding/societies/:id/residents/:residentId ────────────────
// Remove a resident
router.delete("/societies/:id/residents/:residentId", async (req, res) => {
  const { id, residentId } = req.params;
  try {
    const result = await dbQuery(
      `DELETE FROM residents WHERE id = $1 AND society_id = $2 RETURNING id`,
      [residentId, id],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete resident error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/onboarding/societies/:id/reset-secretary-password ───────────────
// Generates a new temporary password for the society's secretary auth account.
// Returns the plain-text password ONE TIME — it is never stored in plain text.
router.post("/societies/:id/reset-secretary-password", async (req, res) => {
  const { id } = req.params;
  try {
    const socResult = await dbQuery(
      `SELECT building_id FROM societies WHERE id = $1`,
      [id],
    );
    if (!socResult?.rows?.length) return res.status(404).json({ error: "society_not_found" });

    const { building_id } = socResult.rows[0];
    if (!building_id) return res.status(400).json({ error: "no_building_id" });

    const tempPassword = genTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Upsert — create if somehow missing, update if exists
    await dbQuery(
      `INSERT INTO auth_accounts (username, password_hash, portal_role, society_id, force_password_reset)
       VALUES ($1, $2, 'SOCIETY_ADMIN', $3, TRUE)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             force_password_reset = TRUE`,
      [building_id, passwordHash, id],
    );

    return res.json({
      secretaryCredentials: {
        username:     building_id,
        tempPassword,
        note: "Share with the society secretary. Password must be changed on first login.",
      },
    });
  } catch (err) {
    console.error("Reset secretary password error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/onboarding/societies/:id/guard-account ──────────────────────────
// Returns whether a guard account exists (no password returned).

router.get("/societies/:id/guard-account", async (req, res) => {
  const societyId = parseInt(req.params.id, 10);
  if (!societyId) return res.status(400).json({ error: "invalid_id" });

  try {
    const result = await dbQuery(
      `SELECT id, username, is_active, created_at FROM guard_accounts WHERE society_id = $1 LIMIT 1`,
      [societyId],
    );

    if (!result?.rows?.length) {
      return res.json({ exists: false });
    }

    const { username, is_active, created_at } = result.rows[0];
    return res.json({ exists: true, username, isActive: is_active, createdAt: created_at });
  } catch (err) {
    console.error("Get guard account error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/onboarding/societies/:id/guard-account ─────────────────────────
// Create or replace the guard account for a society.

router.post("/societies/:id/guard-account", async (req, res) => {
  const societyId = parseInt(req.params.id, 10);
  if (!societyId) return res.status(400).json({ error: "invalid_id" });

  const { username, password } = req.body || {};

  if (!username?.trim()) {
    return res.status(400).json({ error: "username_required" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "password_too_short" });
  }

  try {
    // Verify society exists
    const soc = await dbQuery(`SELECT id FROM societies WHERE id = $1`, [societyId]);
    if (!soc?.rows?.length) return res.status(404).json({ error: "society_not_found" });

    const passwordHash = await bcrypt.hash(password, 12);

    await dbQuery(
      `INSERT INTO guard_accounts (society_id, username, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (society_id) DO UPDATE
         SET username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             updated_at = NOW()`,
      [societyId, username.trim(), passwordHash],
    );

    return res.json({ success: true, username: username.trim() });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "username_taken" });
    }
    console.error("Set guard account error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
