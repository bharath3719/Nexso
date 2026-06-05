/**
 * services/razorpayService.js
 * ────────────────────────────
 * Razorpay Payment Links integration.
 *
 * Creates a unique Razorpay Payment Link per maintenance due.
 * When the resident pays, Razorpay fires a webhook → we auto-mark the due PAID.
 *
 * Required env vars:
 *   RAZORPAY_KEY_ID        — from Razorpay dashboard → Settings → API Keys
 *   RAZORPAY_KEY_SECRET    — same
 *   RAZORPAY_WEBHOOK_SECRET — from dashboard → Settings → Webhooks
 */

import Razorpay from "razorpay";
import crypto   from "crypto";
import { log }  from "../utils/logger.js";

// ── Lazy singleton ─────────────────────────────────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;

  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    log("Razorpay: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set — payment links disabled.");
    return null;
  }

  _client = new Razorpay({ key_id, key_secret });
  return _client;
}

// ── Public: is Razorpay configured? ──────────────────────────────────────────

export function isRazorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

// ── Public: create a payment link for a maintenance due ───────────────────────
/**
 * @param {object} opts
 * @param {number}  opts.dueId
 * @param {number}  opts.societyId
 * @param {number}  opts.residentId
 * @param {string}  opts.residentName
 * @param {string}  [opts.residentEmail]
 * @param {string}  [opts.residentPhone]
 * @param {number}  opts.amount         Amount in INR (not paise)
 * @param {string}  opts.dueMonth       'YYYY-MM'
 * @param {string}  opts.dueDate        'YYYY-MM-DD'
 * @param {string}  opts.societyName
 *
 * @returns {Promise<{id: string, short_url: string}|null>}
 */
export async function createPaymentLink(opts) {
  const client = getClient();
  if (!client) return null;

  const {
    dueId, societyId, residentId,
    residentName, residentEmail, residentPhone,
    amount, dueMonth, dueDate, societyName,
  } = opts;

  // Expire 3 days after the due date so late payers can still use the link
  const expireBy = Math.floor(new Date(dueDate).getTime() / 1000) + 86400 * 3;

  const payload = {
    amount:          Math.round(Number(amount) * 100), // Razorpay uses paise
    currency:        "INR",
    accept_partial:  false,
    description:     `Maintenance — ${societyName} — ${dueMonth}`,
    customer: {
      name:    residentName,
      ...(residentEmail ? { email:   residentEmail } : {}),
      ...(residentPhone ? { contact: residentPhone } : {}),
    },
    notify: {
      sms:   false,   // we send our own WhatsApp / email
      email: false,
    },
    reminder_enable: false,  // we handle reminders ourselves
    expire_by:       expireBy,
    notes: {
      nexso_due_id:   String(dueId),
      nexso_society:  String(societyId),
      nexso_resident: String(residentId),
      due_month:      dueMonth,
    },
  };

  try {
    const link = await client.paymentLink.create(payload);
    log(`[Razorpay] Payment link created for due #${dueId}: ${link.short_url}`);
    return { id: link.id, short_url: link.short_url };
  } catch (err) {
    log(`[Razorpay] Failed to create payment link for due #${dueId}: ${err.message}`);
    return null;
  }
}

// ── Public: verify webhook signature ─────────────────────────────────────────
/**
 * Razorpay signs every webhook payload with HMAC-SHA256.
 * Throws if the signature is invalid.
 *
 * @param {Buffer|string} rawBody   The raw request body (req.rawBody)
 * @param {string}        signature The X-Razorpay-Signature header value
 */
export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET not set");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (expected !== signature) {
    throw new Error("Razorpay webhook signature mismatch");
  }
}
