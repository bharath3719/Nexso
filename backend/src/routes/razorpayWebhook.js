/**
 * routes/razorpayWebhook.js
 * ──────────────────────────
 * Handles Razorpay webhook events.
 * Mount at: POST /webhook/razorpay
 *
 * Events handled:
 *   payment_link.paid  →  auto-mark maintenance due as PAID
 *
 * Setup in Razorpay dashboard:
 *   Dashboard → Settings → Webhooks → Add new webhook
 *   URL: https://yourdomain.com/webhook/razorpay
 *   Secret: set RAZORPAY_WEBHOOK_SECRET in .env to the same value
 *   Events: ✅ payment_link.paid
 */

import express from "express";
import { dbQuery }               from "../db/index.js";
import { verifyWebhookSignature } from "../services/razorpayService.js";
import { log }                   from "../utils/logger.js";

const router = express.Router();

router.post("/", async (req, res) => {
  // ── 1. Verify signature ──────────────────────────────────────────────────────
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    log("[RazorpayWebhook] Missing X-Razorpay-Signature header");
    return res.status(400).json({ error: "missing_signature" });
  }

  try {
    verifyWebhookSignature(req.rawBody, signature);
  } catch (err) {
    log("[RazorpayWebhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: "invalid_signature" });
  }

  const event = req.body?.event;
  log(`[RazorpayWebhook] Event received: ${event}`);

  // ── 2. Handle payment_link.paid ──────────────────────────────────────────────
  if (event === "payment_link.paid") {
    try {
      const linkEntity    = req.body?.payload?.payment_link?.entity;
      const paymentEntity = req.body?.payload?.payment?.entity;

      const razorpayLinkId   = linkEntity?.id;
      const razorpayPaymentId = paymentEntity?.id;
      const paidAmount        = paymentEntity?.amount; // in paise
      const method            = paymentEntity?.method;

      // UTR / RRN reference (UPI transaction reference)
      const rrn = paymentEntity?.acquirer_data?.rrn
               || paymentEntity?.acquirer_data?.upi_transaction_id
               || null;

      if (!razorpayLinkId) {
        log("[RazorpayWebhook] No payment_link id in payload");
        return res.status(200).json({ ok: true }); // ACK to Razorpay
      }

      // Find the due by Razorpay link ID
      const dueResult = await dbQuery(
        `SELECT id, status, society_id, resident_id
         FROM maintenance_dues
         WHERE razorpay_payment_link_id = $1`,
        [razorpayLinkId],
      );

      if (!dueResult?.rows?.length) {
        log(`[RazorpayWebhook] No due found for link ${razorpayLinkId}`);
        return res.status(200).json({ ok: true }); // ACK anyway
      }

      const due = dueResult.rows[0];

      if (due.status === "PAID") {
        log(`[RazorpayWebhook] Due #${due.id} already marked PAID — skipping`);
        return res.status(200).json({ ok: true });
      }

      // Build payment reference string
      const paymentRef = [
        razorpayPaymentId,
        rrn ? `UTR:${rrn}` : null,
        method ? `via ${method.toUpperCase()}` : null,
      ].filter(Boolean).join(" | ");

      // Mark as PAID
      await dbQuery(
        `UPDATE maintenance_dues SET
           status                  = 'PAID',
           payment_date            = NOW(),
           razorpay_payment_id     = $1,
           payment_reference       = $2,
           updated_at              = NOW()
         WHERE id = $3`,
        [razorpayPaymentId || null, paymentRef || null, due.id],
      );

      log(
        `[RazorpayWebhook] ✅ Due #${due.id} auto-marked PAID` +
        ` | Razorpay: ${razorpayPaymentId}` +
        ` | Amount: ₹${paidAmount / 100}` +
        (rrn ? ` | UTR: ${rrn}` : ""),
      );

    } catch (err) {
      log("[RazorpayWebhook] Error processing payment_link.paid:", err.message);
      // Still return 200 so Razorpay doesn't retry indefinitely
    }
  }

  // Always acknowledge to Razorpay
  return res.status(200).json({ ok: true });
});

export default router;
