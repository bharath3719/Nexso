/**
 * routes/maintenance.js
 * ──────────────────────
 * Admin-scoped maintenance endpoints (NEXSO_ADMIN only).
 * Secretary-scoped maintenance lives in routes/secretary.js.
 *
 *   GET    /api/maintenance/dues              — list dues (societyId, month, status)
 *   PATCH  /api/maintenance/dues/:id          — mark paid / waived / update
 *   POST   /api/maintenance/generate          — generate dues for a society+month
 *   POST   /api/maintenance/send-reminders    — send WhatsApp reminders
 *   GET    /api/maintenance/settings/unit/:uid — get unit maintenance settings
 *   PUT    /api/maintenance/settings/unit/:uid — upsert unit maintenance settings
 *   GET    /api/maintenance/society/:id       — get/update society maintenance config
 *   PATCH  /api/maintenance/society/:id       — toggle enabled + set UPI ID
 */

import express from "express";
import { dbQuery } from "../db/index.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendWhatsAppText, sendWhatsAppDocument } from "../services/notifications.js";
import { saveBillAndGetUrl } from "../services/billPdf.js";
import { sendMaintenanceReminderEmail, isEmailConfigured } from "../services/email.js";
import { createPaymentLink, isRazorpayConfigured } from "../services/razorpayService.js";

const router = express.Router();
router.use(requireAdmin);

// ── Shared helper: build dues stats from row array ─────────────────────────────

function buildStats(dues) {
  return {
    total:           dues.length,
    paid:            dues.filter((d) => d.status === "PAID").length,
    pending:         dues.filter((d) => d.status === "PENDING").length,
    overdue:         dues.filter((d) => d.status === "OVERDUE").length,
    waived:          dues.filter((d) => d.status === "WAIVED").length,
    totalAmount:     dues.reduce((s, d) => s + Number(d.amount || 0), 0),
    collectedAmount: dues
      .filter((d) => d.status === "PAID")
      .reduce((s, d) => s + Number(d.amount || 0), 0),
  };
}

// ── GET /api/maintenance/dues ─────────────────────────────────────────────────

router.get("/dues", async (req, res) => {
  try {
    const { societyId, month, status } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let sql = `
      SELECT
        md.*,
        r.name                          AS resident_name,
        r.phone                         AS resident_phone,
        u.unit_number,
        COALESCE(td.name, tf.name)      AS tower_name,
        s.name                          AS society_name
      FROM maintenance_dues md
      JOIN residents r ON r.id  = md.resident_id
      JOIN units     u ON u.id  = r.unit_id
      LEFT JOIN towers td ON td.id = u.tower_id
      LEFT JOIN floors f  ON f.id  = u.floor_id
      LEFT JOIN towers tf ON tf.id = f.tower_id
      JOIN societies s ON s.id  = md.society_id
      WHERE md.due_month = $1`;
    const params = [targetMonth];

    if (societyId) {
      params.push(Number(societyId));
      sql += ` AND md.society_id = $${params.length}`;
    }
    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND md.status = $${params.length}`;
    }

    sql += ` ORDER BY s.name, COALESCE(td.name, tf.name) NULLS LAST, u.unit_number, r.name`;

    const result = await dbQuery(sql, params);
    const dues    = result?.rows || [];

    return res.json({ dues, stats: buildStats(dues), month: targetMonth });
  } catch (err) {
    console.error("Maintenance dues list error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/maintenance/dues/:id ──────────────────────────────────────────

router.patch("/dues/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_reference, notes } = req.body || {};

    const VALID = ["PENDING", "PAID", "OVERDUE", "WAIVED"];
    if (status && !VALID.includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    const result = await dbQuery(
      `UPDATE maintenance_dues SET
         status            = COALESCE($1, status),
         payment_reference = COALESCE($2, payment_reference),
         notes             = COALESCE($3, notes),
         payment_date      = CASE WHEN $1 = 'PAID' AND payment_date IS NULL THEN NOW() ELSE payment_date END,
         updated_at        = NOW()
       WHERE id = $4
       RETURNING *`,
      [status || null, payment_reference || null, notes || null, id],
    );

    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ due: result.rows[0] });
  } catch (err) {
    console.error("Maintenance dues update error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/maintenance/generate ────────────────────────────────────────────
// Creates maintenance_dues rows for all enabled residents in a society for a given month.

router.post("/generate", async (req, res) => {
  try {
    const { societyId, month } = req.body || {};
    if (!societyId) return res.status(400).json({ error: "societyId_required" });

    const targetMonth  = month || new Date().toISOString().slice(0, 7);
    const [year, mon]  = targetMonth.split("-").map(Number);

    const settings = await dbQuery(
      `SELECT ms.unit_id, ms.amount, ms.due_day
       FROM maintenance_settings ms
       WHERE ms.society_id = $1
         AND ms.enabled = TRUE
         AND ms.amount  IS NOT NULL AND ms.amount  > 0
         AND ms.due_day IS NOT NULL`,
      [societyId],
    );

    if (!settings?.rows?.length) {
      return res.json({ created: 0, skipped: 0, message: "No active maintenance settings found." });
    }

    // Fetch society info needed for Razorpay link description
    const socRes = await dbQuery(
      `SELECT name FROM societies WHERE id = $1`, [societyId],
    );
    const societyName = socRes?.rows?.[0]?.name || "Society";
    const rzpEnabled  = isRazorpayConfigured();

    let created = 0;
    let skipped = 0;

    for (const s of settings.rows) {
      // Current occupant: TENANT first, then OWNER
      const occupantRes = await dbQuery(
        `SELECT id, name, phone, email FROM residents
         WHERE unit_id = $1
         ORDER BY CASE WHEN resident_type = 'TENANT' THEN 0 ELSE 1 END
         LIMIT 1`,
        [s.unit_id],
      );
      const occupant = occupantRes?.rows?.[0];
      if (!occupant) { skipped++; continue; }

      const dueDate    = new Date(Date.UTC(year, mon - 1, s.due_day));
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      const r = await dbQuery(
        `INSERT INTO maintenance_dues
           (resident_id, society_id, amount, due_month, due_date, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         ON CONFLICT (resident_id, due_month) DO NOTHING
         RETURNING id`,
        [occupant.id, societyId, s.amount, targetMonth, dueDateStr],
      );

      if (!r?.rows?.length) { skipped++; continue; }

      const dueId = r.rows[0].id;
      created++;

      // Create Razorpay payment link if configured
      if (rzpEnabled) {
        const link = await createPaymentLink({
          dueId, societyId, residentId: occupant.id,
          residentName:  occupant.name  || "Resident",
          residentEmail: occupant.email || null,
          residentPhone: occupant.phone || null,
          amount:     s.amount,
          dueMonth:   targetMonth,
          dueDate:    dueDateStr,
          societyName,
        });
        if (link) {
          await dbQuery(
            `UPDATE maintenance_dues
             SET razorpay_payment_link_id = $1, payment_link = $2
             WHERE id = $3`,
            [link.id, link.short_url, dueId],
          );
        }
      }
    }

    return res.json({ created, skipped, month: targetMonth, razorpay: rzpEnabled });
  } catch (err) {
    console.error("Maintenance generate error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── POST /api/maintenance/send-reminders ─────────────────────────────────────
// Sends WhatsApp reminders to residents whose due_date is within 7 days and
// whose reminder_sent_at is NULL (i.e. not yet reminded this cycle).

router.post("/send-reminders", async (req, res) => {
  try {
    const { societyId, month } = req.body || {};
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let sql = `
      SELECT md.id, md.amount, md.due_date, md.payment_link,
             md.resident_id, md.society_id,
             r.name AS resident_name, r.phone, r.email AS resident_email,
             s.name AS society_name, s.maintenance_upi_id
      FROM maintenance_dues md
      JOIN residents r ON r.id = md.resident_id
      JOIN societies s ON s.id = md.society_id
      WHERE md.status = 'PENDING'
        AND md.due_month = $1
        AND md.due_date - INTERVAL '7 days' <= CURRENT_DATE
        AND md.reminder_sent_at IS NULL`;
    const params = [targetMonth];

    if (societyId) {
      params.push(Number(societyId));
      sql += ` AND md.society_id = $${params.length}`;
    }

    const dues = await dbQuery(sql, params);
    let sent = 0;
    let failed = 0;
    const emailEnabled = isEmailConfigured();

    for (const due of dues?.rows || []) {
      const hasEmail = !!due.resident_email;
      const hasPhone = !!due.phone;
      if (!hasEmail && !hasPhone) { failed++; continue; }

      let notified = false;

      // Prefer email (free)
      if (hasEmail && emailEnabled) {
        const r = await sendMaintenanceReminderEmail({
          to:           due.resident_email,
          residentName: due.resident_name,
          societyName:  due.society_name,
          amount:       due.amount,
          dueMonth:     targetMonth,
          dueDate:      due.due_date,
          upiId:        due.maintenance_upi_id || null,
          paymentLink:  due.payment_link || null,
        });
        if (r.sent) notified = true;
      }

      // Fall back to WhatsApp
      if (!notified && hasPhone) {
        const dueDateFmt = new Date(due.due_date).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        });
        const amountFmt = Number(due.amount).toLocaleString("en-IN");
        let msg = `Hi ${due.resident_name},\n\nYour monthly maintenance of ₹${amountFmt} for ${targetMonth} is due on ${dueDateFmt}.`;
        if (due.payment_link) {
          msg += `\n\n💳 *Pay now:* ${due.payment_link}`;
        } else if (due.maintenance_upi_id) {
          msg += `\n\nPay via UPI: *${due.maintenance_upi_id}*`;
        }
        msg += `\n\nPlease pay on time.\n\n— ${due.society_name} Management`;
        try {
          const billPdfEnabled = !!process.env.BACKEND_PUBLIC_URL;
          if (billPdfEnabled) {
            const { url: pdfUrl } = await saveBillAndGetUrl(
              due.society_id, due.resident_id, targetMonth, due.payment_link, due.maintenance_upi_id,
            );
            await sendWhatsAppDocument(due.phone, pdfUrl, `Maintenance bill for ${targetMonth} — ${due.society_name}`);
            await sendWhatsAppText(due.phone, msg);
          } else {
            await sendWhatsAppText(due.phone, msg);
          }
          notified = true;
        } catch (e) {
          console.error(`WhatsApp reminder failed for ${due.phone}:`, e.message);
          try {
            await sendWhatsAppText(due.phone, msg);
            notified = true;
          } catch (fallbackErr) {
            console.error(`WhatsApp text fallback also failed for ${due.phone}:`, fallbackErr.message);
          }
        }
      }

      if (notified) {
        await dbQuery(
          `UPDATE maintenance_dues SET reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [due.id],
        );
        sent++;
      } else {
        failed++;
      }
    }

    return res.json({ sent, failed, total: dues?.rows?.length || 0 });
  } catch (err) {
    console.error("Send reminders error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/maintenance/settings/unit/:uid ───────────────────────────────────

router.get("/settings/unit/:uid", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT * FROM maintenance_settings WHERE unit_id = $1`,
      [req.params.uid],
    );
    return res.json({ settings: result?.rows?.[0] || null });
  } catch (err) {
    console.error("Maintenance settings get error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PUT /api/maintenance/settings/unit/:uid ───────────────────────────────────

router.put("/settings/unit/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { societyId, enabled, amount, due_day } = req.body || {};

    if (!societyId) return res.status(400).json({ error: "societyId_required" });

    const result = await dbQuery(
      `INSERT INTO maintenance_settings (unit_id, society_id, enabled, amount, due_day)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (unit_id) DO UPDATE SET
         enabled    = EXCLUDED.enabled,
         amount     = EXCLUDED.amount,
         due_day    = EXCLUDED.due_day,
         updated_at = NOW()
       RETURNING *`,
      [uid, societyId, !!enabled, amount || null, due_day || null],
    );
    return res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error("Maintenance settings upsert error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/maintenance/society/:id ─────────────────────────────────────────

router.get("/society/:id", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT id, name, maintenance_enabled, maintenance_upi_id FROM societies WHERE id = $1`,
      [req.params.id],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ society: result.rows[0] });
  } catch (err) {
    console.error("Maintenance society get error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/maintenance/society/:id ────────────────────────────────────────

router.patch("/society/:id", async (req, res) => {
  try {
    const { maintenance_enabled, maintenance_upi_id } = req.body || {};
    const result = await dbQuery(
      `UPDATE societies SET
         maintenance_enabled = COALESCE($1, maintenance_enabled),
         maintenance_upi_id  = COALESCE($2, maintenance_upi_id)
       WHERE id = $3
       RETURNING id, name, maintenance_enabled, maintenance_upi_id`,
      [
        maintenance_enabled != null ? !!maintenance_enabled : null,
        maintenance_upi_id  != null ? maintenance_upi_id    : null,
        req.params.id,
      ],
    );
    if (!result?.rows?.length) return res.status(404).json({ error: "not_found" });
    return res.json({ society: result.rows[0] });
  } catch (err) {
    console.error("Maintenance society patch error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
