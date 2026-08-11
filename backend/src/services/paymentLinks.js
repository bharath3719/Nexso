/**
 * services/paymentLinks.js
 * ────────────────────────
 * One seam for "give me a payment link for this due", so callers don't care
 * which rail is live. Two providers:
 *
 *   razorpay — hosted Payment Link, reconciled automatically by the
 *              payment_link.paid webhook. Needs activated Razorpay keys.
 *   upi      — our own /pay/:token page driving a UPI intent link to the
 *              society's VPA. No gateway onboarding at all, but the resident
 *              self-declares the UTR and the secretary verifies it.
 *
 * Selected by PAYMENT_PROVIDER:
 *   'auto' (default) — Razorpay when its keys are set, otherwise UPI
 *   'razorpay'       — force Razorpay (no UPI fallback)
 *   'upi'            — force UPI even when Razorpay keys exist
 *
 * Whichever provider answers, the resulting URL is written to
 * maintenance_dues.payment_link — which already flows into the WhatsApp
 * reminder, the email template and the bill PDF.
 */

import { dbQuery } from "../db/index.js";
import { createPaymentLink as createRazorpayLink, isRazorpayConfigured } from "./razorpayService.js";
import { generatePayToken, buildPayUrl, isValidVpa } from "./upiService.js";
import { log } from "../utils/logger.js";

/** @returns {'razorpay'|'upi'} */
export function activeProvider() {
  const configured = (process.env.PAYMENT_PROVIDER || "auto").toLowerCase();
  if (configured === "razorpay") return "razorpay";
  if (configured === "upi")      return "upi";
  return isRazorpayConfigured() ? "razorpay" : "upi";
}

/**
 * True when the active provider can actually mint links right now. UPI also
 * needs BACKEND_PUBLIC_URL, since the link we send must be publicly reachable.
 */
export function isPaymentConfigured() {
  return activeProvider() === "razorpay"
    ? isRazorpayConfigured()
    : !!process.env.BACKEND_PUBLIC_URL;
}

/**
 * Create a payment link for a due and persist it on the row.
 *
 * @param {object}  opts
 * @param {number}  opts.dueId
 * @param {number}  opts.societyId
 * @param {number}  opts.residentId
 * @param {string}  opts.residentName
 * @param {string}  [opts.residentEmail]
 * @param {string}  [opts.residentPhone]
 * @param {number}  opts.amount        INR
 * @param {string}  opts.dueMonth      'YYYY-MM'
 * @param {string}  opts.dueDate       'YYYY-MM-DD'
 * @param {string}  opts.societyName
 * @param {string}  [opts.societyUpiId] Required for the UPI provider
 *
 * @returns {Promise<{url: string, provider: string}|null>}
 */
export async function createDuePaymentLink(opts) {
  const provider = activeProvider();

  if (provider === "razorpay") {
    const link = await createRazorpayLink(opts);
    if (!link) return null;

    await dbQuery(
      `UPDATE maintenance_dues
          SET razorpay_payment_link_id = $1, payment_link = $2
        WHERE id = $3`,
      [link.id, link.short_url, opts.dueId],
    );
    return { url: link.short_url, provider };
  }

  // ── UPI ────────────────────────────────────────────────────────────────────
  if (!isValidVpa(opts.societyUpiId)) {
    log(`[Pay] Due #${opts.dueId}: society has no valid UPI ID — no link created.`);
    return null;
  }

  if (!process.env.BACKEND_PUBLIC_URL) {
    log(`[Pay] Due #${opts.dueId}: BACKEND_PUBLIC_URL not set — no link created.`);
    return null;
  }

  // Keep any token already issued for this due — links may already be in a
  // resident's WhatsApp history, and re-minting would break them.
  const claimed = await dbQuery(
    `UPDATE maintenance_dues
        SET pay_token = COALESCE(pay_token, $1)
      WHERE id = $2
      RETURNING pay_token`,
    [generatePayToken(), opts.dueId],
  );

  const token = claimed?.rows?.[0]?.pay_token;
  if (!token) return null;

  const url = buildPayUrl(token);
  await dbQuery(
    `UPDATE maintenance_dues SET payment_link = $1 WHERE id = $2`,
    [url, opts.dueId],
  );

  log(`[Pay] UPI pay link created for due #${opts.dueId}: ${url}`);
  return { url, provider };
}
