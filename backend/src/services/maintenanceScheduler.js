/**
 * services/maintenanceScheduler.js
 * ──────────────────────────────────
 * Background cron jobs for maintenance collection.
 *
 * Schedule (IST — UTC+5:30):
 *   • Every day at 9:00 AM IST  → send WhatsApp reminders to residents
 *                                  whose due_date is within 7 days and
 *                                  whose reminder_sent_at IS NULL.
 *   • 1st of every month at 8:00 AM IST → auto-generate dues for all
 *                                  societies that have maintenance_enabled = true.
 *
 * Call startMaintenanceScheduler() once from server startup.
 */

import cron from "node-cron";
import { dbQuery } from "../db/index.js";
import { sendWhatsAppText, sendWhatsAppDocument } from "./notifications.js";
import { saveBillAndGetUrl } from "./billPdf.js";
import { sendMaintenanceReminderEmail, isEmailConfigured } from "./email.js";
import { createPaymentLink, isRazorpayConfigured } from "./razorpayService.js";
import { log } from "../utils/logger.js";

// ── Helper: current YYYY-MM ────────────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// ── Generate dues for all enabled societies ────────────────────────────────────
//
// Creates maintenance_dues rows for every resident whose maintenance_settings
// has enabled=true for the given month (if the row doesn't already exist).

async function generateDuesForAllSocieties(month) {
  log(`[Maintenance] Auto-generating dues for ${month}…`);

  const [year, mon] = month.split("-").map(Number);

  try {
    // Fetch all societies with maintenance turned on
    const societies = await dbQuery(
      `SELECT id, name FROM societies WHERE maintenance_enabled = TRUE`,
    );

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const soc of societies?.rows || []) {
      const settings = await dbQuery(
        `SELECT unit_id, amount, due_day FROM maintenance_settings
         WHERE society_id = $1 AND enabled = TRUE
           AND amount IS NOT NULL AND amount > 0
           AND due_day IS NOT NULL`,
        [soc.id],
      );

      for (const s of settings?.rows || []) {
        // Find current occupant: TENANT if the unit is rented out, else OWNER
        const occupantRes = await dbQuery(
          `SELECT id, name, phone, email FROM residents
           WHERE unit_id = $1
           ORDER BY CASE WHEN resident_type = 'TENANT' THEN 0 ELSE 1 END
           LIMIT 1`,
          [s.unit_id],
        );
        const occupant = occupantRes?.rows?.[0];
        if (!occupant) { totalSkipped++; continue; }

        const dueDate    = new Date(Date.UTC(year, mon - 1, s.due_day));
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        const r = await dbQuery(
          `INSERT INTO maintenance_dues
             (resident_id, society_id, amount, due_month, due_date, status)
           VALUES ($1, $2, $3, $4, $5, 'PENDING')
           ON CONFLICT (resident_id, due_month) DO NOTHING
           RETURNING id`,
          [occupant.id, soc.id, s.amount, month, dueDateStr],
        );

        if (!r?.rows?.length) { totalSkipped++; continue; }

        const dueId = r.rows[0].id;
        totalCreated++;

        // Create Razorpay payment link for each new due
        if (isRazorpayConfigured()) {
          const link = await createPaymentLink({
            dueId, societyId: soc.id, residentId: occupant.id,
            residentName:  occupant.name  || "Resident",
            residentEmail: occupant.email || null,
            residentPhone: occupant.phone || null,
            amount:     s.amount,
            dueMonth:   month,
            dueDate:    dueDateStr,
            societyName: soc.name,
          });
          if (link) {
            await dbQuery(
              `UPDATE maintenance_dues SET razorpay_payment_link_id = $1, payment_link = $2 WHERE id = $3`,
              [link.id, link.short_url, dueId],
            );
          }
        }
      }

      log(`[Maintenance] ${soc.name}: generated dues (created: ${totalCreated}, skipped: ${totalSkipped})`);
    }

    log(`[Maintenance] Dues generation complete — created: ${totalCreated}, skipped: ${totalSkipped}`);
  } catch (err) {
    log("[Maintenance] Error during dues generation:", err.message);
  }
}

// ── Send reminders for all enabled societies ───────────────────────────────────
//
// Finds all PENDING dues where:
//   • due_date - 7 days <= today  (i.e. 7 days or fewer remain)
//   • reminder_sent_at IS NULL    (not yet reminded this cycle)
// then sends a WhatsApp message and stamps reminder_sent_at.

async function sendDueReminders() {
  const month = currentMonth();
  log(`[Maintenance] Running reminder job for ${month}…`);

  try {
    const dues = await dbQuery(
      `SELECT md.id, md.amount, md.due_date, md.payment_link,
              md.resident_id, md.society_id,
              r.name  AS resident_name,
              r.phone AS resident_phone,
              r.email AS resident_email,
              s.name  AS society_name,
              s.maintenance_upi_id
       FROM maintenance_dues md
       JOIN residents r ON r.id  = md.resident_id
       JOIN societies s ON s.id  = md.society_id
       WHERE s.maintenance_enabled = TRUE
         AND md.status       = 'PENDING'
         AND md.due_month    = $1
         AND md.due_date - INTERVAL '7 days' <= CURRENT_DATE
         AND md.reminder_sent_at IS NULL`,
      [month],
    );

    const rows = dues?.rows || [];
    log(`[Maintenance] ${rows.length} reminder(s) to send.`);

    let sent   = 0;
    let failed = 0;

    const emailEnabled = isEmailConfigured();

    for (const due of rows) {
      const hasEmail = !!due.resident_email;
      const hasPhone = !!due.resident_phone;

      if (!hasEmail && !hasPhone) {
        log(`[Maintenance] Skipping ${due.resident_name} — no email or phone.`);
        failed++;
        continue;
      }

      let notified = false;

      // ── Prefer email (free) ──────────────────────────────────────────────────
      if (hasEmail && emailEnabled) {
        const result = await sendMaintenanceReminderEmail({
          to:           due.resident_email,
          residentName: due.resident_name,
          societyName:  due.society_name,
          amount:       due.amount,
          dueMonth:     month,
          dueDate:      due.due_date,
          upiId:        due.maintenance_upi_id || null,
          paymentLink:  due.payment_link       || null,
        });
        if (result.sent) {
          log(`[Maintenance] Email reminder sent to ${due.resident_name} <${due.resident_email}>`);
          notified = true;
        }
      }

      // ── Fall back to WhatsApp if email not sent ──────────────────────────────
      if (!notified && hasPhone) {
        const dueDateFmt = new Date(due.due_date).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        });
        const amountFmt = Number(due.amount).toLocaleString("en-IN");

        let msg =
          `Hi ${due.resident_name},\n\n` +
          `Your monthly maintenance of ₹${amountFmt} for ${month} is due on ${dueDateFmt}.`;
        if (due.payment_link) {
          msg += `\n\n💳 *Pay now:* ${due.payment_link}`;
        } else if (due.maintenance_upi_id) {
          msg += `\n\nPay via UPI: *${due.maintenance_upi_id}*`;
        }
        msg += `\n\nPlease pay on time.\n\n— ${due.society_name} Management`;

        try {
          // Try to send bill PDF; fall back to text if PDF generation or URL is unavailable
          const billPdfEnabled = !!process.env.BACKEND_PUBLIC_URL;
          if (billPdfEnabled) {
            const { url: pdfUrl } = await saveBillAndGetUrl(
              due.society_id, due.resident_id, month, due.payment_link, due.maintenance_upi_id,
            );
            await sendWhatsAppDocument(due.resident_phone, pdfUrl, `Maintenance bill for ${month} — ${due.society_name}`);
            // Follow up with the text so the payment link is tappable
            await sendWhatsAppText(due.resident_phone, msg);
          } else {
            await sendWhatsAppText(due.resident_phone, msg);
          }
          log(`[Maintenance] WhatsApp reminder sent to ${due.resident_name} (${due.resident_phone})`);
          notified = true;
        } catch (err) {
          log(`[Maintenance] WhatsApp failed for ${due.resident_phone}: ${err.message}`);
          // Last-resort: plain text only
          try {
            await sendWhatsAppText(due.resident_phone, msg);
            log(`[Maintenance] WhatsApp text fallback sent to ${due.resident_name}`);
            notified = true;
          } catch (fallbackErr) {
            log(`[Maintenance] WhatsApp text fallback also failed: ${fallbackErr.message}`);
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

    log(`[Maintenance] Reminder job done — sent: ${sent}, failed: ${failed}`);
  } catch (err) {
    log("[Maintenance] Error during reminder job:", err.message);
  }
}

// ── Mark overdue ───────────────────────────────────────────────────────────────
// Runs daily: flips PENDING → OVERDUE for dues whose due_date has passed.

async function markOverdueDues() {
  try {
    const r = await dbQuery(
      `UPDATE maintenance_dues
       SET status = 'OVERDUE', updated_at = NOW()
       WHERE status = 'PENDING'
         AND due_date < CURRENT_DATE
       RETURNING id`,
    );
    const count = r?.rows?.length || 0;
    if (count > 0) log(`[Maintenance] Marked ${count} due(s) as OVERDUE.`);
  } catch (err) {
    log("[Maintenance] Error marking overdue:", err.message);
  }
}

// ── Send overdue notices ───────────────────────────────────────────────────────
// Runs daily after markOverdueDues: notifies residents whose dues are OVERDUE
// and haven't yet received an overdue-specific notice (overdue_notified_at IS NULL).

async function sendOverdueNotices() {
  try {
    const dues = await dbQuery(
      `SELECT md.id, md.amount, md.due_date, md.payment_link, md.due_month,
              r.name  AS resident_name,
              r.phone AS resident_phone,
              s.name  AS society_name,
              s.maintenance_upi_id
       FROM maintenance_dues md
       JOIN residents r ON r.id = md.resident_id
       JOIN societies s ON s.id = md.society_id
       WHERE s.maintenance_enabled = TRUE
         AND md.status = 'OVERDUE'
         AND md.overdue_notified_at IS NULL`,
    );

    const rows = dues?.rows || [];
    if (!rows.length) return;
    log(`[Maintenance] ${rows.length} overdue notice(s) to send.`);

    for (const due of rows) {
      if (!due.resident_phone) continue;

      const dueDateFmt = new Date(due.due_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });
      const amountFmt = Number(due.amount).toLocaleString("en-IN");

      let msg =
        `Hi ${due.resident_name},\n\n` +
        `⚠️ Your maintenance of ₹${amountFmt} for ${due.due_month} was due on ${dueDateFmt} and is now *OVERDUE*.\n\n` +
        `Please make the payment at the earliest to avoid further penalties.`;

      if (due.payment_link) {
        msg += `\n\n💳 *Pay now:* ${due.payment_link}`;
      } else if (due.maintenance_upi_id) {
        msg += `\n\nPay via UPI: *${due.maintenance_upi_id}*`;
      }
      msg += `\n\n— ${due.society_name} Management`;

      try {
        await sendWhatsAppText(due.resident_phone, msg);
        await dbQuery(
          `UPDATE maintenance_dues SET overdue_notified_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [due.id],
        );
        log(`[Maintenance] Overdue notice sent to ${due.resident_name} (${due.resident_phone})`);
      } catch (err) {
        log(`[Maintenance] Overdue notice failed for ${due.resident_phone}: ${err.message}`);
      }
    }
  } catch (err) {
    log("[Maintenance] Error during overdue notices:", err.message);
  }
}

// ── Start all cron jobs ────────────────────────────────────────────────────────

export function startMaintenanceScheduler() {
  // node-cron uses local server time.
  // If your server runs in UTC, adjust hours:
  //   IST 08:00 = UTC 02:30  →  "30 2 1 * *"
  //   IST 09:00 = UTC 03:30  →  "30 3 * * *"
  //
  // If server runs in IST, use the IST times directly.
  // The env var CRON_TZ lets you override; defaults to server local time.

  const tz = process.env.CRON_TIMEZONE || "Asia/Kolkata";

  // ── Job 1: 1st of every month at 8:00 AM — auto-generate dues ───────────────
  cron.schedule("0 8 1 * *", () => {
    generateDuesForAllSocieties(currentMonth());
  }, { timezone: tz });

  // ── Job 2: Every day at 9:00 AM — send WhatsApp reminders ───────────────────
  cron.schedule("0 9 * * *", () => {
    sendDueReminders();
  }, { timezone: tz });

  // ── Job 3: Every day at 9:05 AM — mark overdue dues ─────────────────────────
  cron.schedule("5 9 * * *", () => {
    markOverdueDues();
  }, { timezone: tz });

  // ── Job 4: Every day at 9:10 AM — notify overdue residents ───────────────────
  cron.schedule("10 9 * * *", () => {
    sendOverdueNotices();
  }, { timezone: tz });

  log(
    `[Maintenance] Scheduler started (timezone: ${tz}).\n` +
    `  • Dues auto-generated:  1st of month at 08:00\n` +
    `  • WhatsApp reminders:   daily at 09:00\n` +
    `  • Overdue sweep:        daily at 09:05\n` +
    `  • Overdue notices:      daily at 09:10`,
  );
}
