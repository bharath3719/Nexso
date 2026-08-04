/**
 * services/upiService.js
 * ──────────────────────
 * Zero-onboarding payment rail: a UPI intent link straight to the society's
 * own VPA. No gateway account, no GSTIN, no current account — money lands in
 * the society's bank account the instant the resident confirms in their UPI app.
 *
 * The trade-off vs. a gateway (see razorpayService.js) is reconciliation:
 * for a plain VPA the `tr`/`tn` fields we set are NOT reliably echoed back to
 * the payee, and there is no webhook. So the resident self-declares the UTR on
 * the hosted pay page and the secretary verifies it against their bank app.
 * That's why dues land in PENDING_VERIFICATION rather than PAID.
 *
 * Env vars:
 *   BACKEND_PUBLIC_URL — public origin of this server (also used for bill PDFs)
 *   PAYMENT_PROVIDER   — 'upi' | 'razorpay' | 'auto' (see paymentLinks.js)
 */

import crypto from "crypto";
import QRCode from "qrcode";

// ── Pay tokens ────────────────────────────────────────────────────────────────

/**
 * Opaque, unguessable handle for one due. It is the only credential the public
 * pay page requires — the link goes out over WhatsApp/email, where asking the
 * resident to log in would kill the conversion the demo is meant to show.
 */
export function generatePayToken() {
  return crypto.randomBytes(24).toString("hex");
}

/** Public URL of the hosted pay page for a due, or null if no public origin. */
export function buildPayUrl(token) {
  const base = (process.env.BACKEND_PUBLIC_URL || "").replace(/\/+$/, "");
  if (!base || !token) return null;
  return `${base}/pay/${token}`;
}

// ── UPI intent URI ────────────────────────────────────────────────────────────

/** A VPA is `handle@psp`; keep this loose — PSPs vary but the shape is stable. */
export function isValidVpa(vpa) {
  return typeof vpa === "string" && /^[\w.\-]{2,64}@[a-zA-Z]{2,64}$/.test(vpa.trim());
}

/**
 * Build a `upi://pay?…` deep link per the NPCI UPI Linking Specification.
 *
 * @param {object}  opts
 * @param {string}  opts.vpa         Payee VPA (society's UPI ID)
 * @param {string}  opts.payeeName   Name shown in the payer's UPI app
 * @param {number}  opts.amount      Amount in INR (not paise)
 * @param {string}  [opts.note]      Transaction note (`tn`) — max 50 chars
 * @param {string}  [opts.txnRef]    Transaction reference (`tr`)
 * @returns {string|null}
 */
export function buildUpiUri({ vpa, payeeName, amount, note, txnRef }) {
  if (!isValidVpa(vpa)) return null;

  const params = new URLSearchParams({
    pa: vpa.trim(),
    pn: (payeeName || "Society").slice(0, 50),
    am: Number(amount).toFixed(2),
    cu: "INR",
  });

  // `tn` and `tr` are best-effort: most PSPs display the note but only merchant
  // VPAs reliably return the reference to the payee.
  if (note)   params.set("tn", note.slice(0, 50));
  if (txnRef) params.set("tr", txnRef.slice(0, 35));

  return `upi://pay?${params.toString()}`;
}

/**
 * App-specific variants. Android/iOS both honour `upi://` when exactly one UPI
 * app is installed, but with several installed the chooser is unreliable — so
 * the pay page also offers direct handoffs.
 */
export function buildAppLinks(upiUri) {
  if (!upiUri) return {};
  const query = upiUri.replace(/^upi:\/\/pay\?/, "");
  return {
    gpay:    `tez://upi/pay?${query}`,
    phonepe: `phonepe://pay?${query}`,
    paytm:   `paytmmp://pay?${query}`,
  };
}

// ── QR ────────────────────────────────────────────────────────────────────────

/**
 * Render a UPI URI as a scannable QR, inlined as a data URI so the pay page
 * stays a single self-contained response.
 *
 * @returns {Promise<string|null>} `data:image/png;base64,…`
 */
export async function buildQrDataUri(upiUri) {
  if (!upiUri) return null;
  try {
    return await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#1b1b1f", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

// ── UTR validation ────────────────────────────────────────────────────────────

/**
 * UPI UTR / RRN is 12 alphanumeric characters. We accept it loosely (residents
 * paste from a dozen different app layouts) but reject obvious junk so the
 * secretary's verification queue stays useful.
 */
export function normaliseUtr(raw) {
  const cleaned = String(raw || "").trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{10,22}$/.test(cleaned) ? cleaned : null;
}
