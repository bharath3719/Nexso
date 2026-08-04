/**
 * routes/pay.js
 * ─────────────
 * Public, no-auth payment page for a single maintenance due.
 * Mount at: /pay  (must be registered BEFORE the SPA static catch-all)
 *
 *   GET  /pay/:token        → self-contained HTML page: UPI button + QR + UTR form
 *   POST /pay/:token/claim  → resident declares the UTR → PENDING_VERIFICATION
 *
 * The token is the only credential: the link is delivered over WhatsApp/email
 * and a login wall there would kill the flow. Tokens are 48 hex chars, scoped
 * to one due, and reveal nothing beyond that due's own details.
 *
 * Reconciliation is deliberately manual — see services/upiService.js for why.
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { dbQuery } from "../db/index.js";
import {
  buildUpiUri, buildAppLinks, buildQrDataUri, normaliseUtr, isValidVpa,
} from "../services/upiService.js";
import { sendWhatsAppText } from "../services/notifications.js";
import { log } from "../utils/logger.js";

const router = express.Router();

// Public and unauthenticated — cap brute-force scanning of the token space.
const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

router.use(payLimiter);

// Accept form posts from the page itself
router.use(express.urlencoded({ extended: false }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const inr = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadDue(token) {
  if (!/^[a-f0-9]{16,64}$/.test(String(token || ""))) return null;

  const r = await dbQuery(
    `SELECT md.id, md.amount, md.due_month, md.due_date, md.status,
            md.claimed_utr, md.claimed_at, md.payment_date, md.payment_reference,
            r.name  AS resident_name, r.phone AS resident_phone,
            s.id    AS society_id,
            s.name  AS society_name,
            s.maintenance_upi_id, s.maintenance_payee_name,
            u.unit_number, t.name AS tower_name
       FROM maintenance_dues md
       JOIN residents r ON r.id = md.resident_id
       JOIN societies s ON s.id = md.society_id
       LEFT JOIN units  u ON u.id = r.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
      WHERE md.pay_token = $1`,
    [token],
  );
  return r?.rows?.[0] || null;
}

// ── Page shell ────────────────────────────────────────────────────────────────

function page({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#f4f4f7; --card:#fff; --fg:#1b1b1f; --muted:#5f5f6b;
          --line:#e3e3e8; --brand:#0f6cbd; --ok:#0b6a35; --okbg:#e6f4ea; --warn:#8a5300; --warnbg:#fdf3e2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16161a; --card:#1f1f25; --fg:#f2f2f5; --muted:#a5a5b3; --line:#33333d;
            --brand:#5aa9f0; --ok:#7ee0a5; --okbg:#123322; --warn:#f0c481; --warnbg:#3a2c12; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:20px 14px 48px; background:var(--bg); color:var(--fg);
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .card { max-width:440px; margin:0 auto; background:var(--card); border:1px solid var(--line);
          border-radius:16px; padding:24px; }
  h1 { font-size:19px; margin:0 0 2px; }
  .sub { color:var(--muted); font-size:13px; margin:0 0 20px; }
  .amount { font-size:38px; font-weight:700; letter-spacing:-.5px; margin:14px 0 2px; }
  .rows { border-top:1px solid var(--line); margin-top:20px; padding-top:14px; }
  .row { display:flex; justify-content:space-between; gap:16px; font-size:14px; padding:5px 0; }
  .row span:first-child { color:var(--muted); }
  .row span:last-child { text-align:right; font-weight:500; }
  .btn { display:block; width:100%; padding:15px; border-radius:11px; border:0; cursor:pointer;
         background:var(--brand); color:#fff; font-size:16px; font-weight:600; text-align:center;
         text-decoration:none; margin-top:18px; font-family:inherit; }
  .btn.secondary { background:transparent; color:var(--brand); border:1px solid var(--line);
                   font-size:14px; padding:11px; }
  .apps { display:flex; gap:8px; margin-top:10px; }
  .apps a { flex:1; padding:10px; border:1px solid var(--line); border-radius:9px; text-align:center;
            font-size:13px; color:var(--fg); text-decoration:none; }
  .qr { text-align:center; margin-top:22px; }
  .qr img { width:210px; height:210px; border-radius:11px; border:1px solid var(--line); background:#fff; }
  .vpa { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:14px;
         background:var(--bg); border:1px solid var(--line); border-radius:8px;
         padding:9px 12px; margin-top:12px; text-align:center; word-break:break-all; }
  .banner { border-radius:11px; padding:14px 16px; font-size:14px; line-height:1.5; margin-bottom:4px; }
  .banner.ok { background:var(--okbg); color:var(--ok); }
  .banner.warn { background:var(--warnbg); color:var(--warn); }
  .divider { display:flex; align-items:center; gap:12px; color:var(--muted);
             font-size:12px; margin:24px 0 4px; }
  .divider::before, .divider::after { content:""; flex:1; height:1px; background:var(--line); }
  label { display:block; font-size:13px; color:var(--muted); margin:16px 0 6px; }
  input { width:100%; padding:13px; font-size:16px; border:1px solid var(--line); border-radius:9px;
          background:var(--bg); color:var(--fg); font-family: ui-monospace, Menlo, monospace;
          text-transform:uppercase; }
  .err { color:#b3261e; font-size:13px; margin-top:8px; }
  .foot { text-align:center; color:var(--muted); font-size:12px; margin-top:22px; line-height:1.6; }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
}

// ── GET /pay/:token ───────────────────────────────────────────────────────────

router.get("/:token", async (req, res) => {
  let due;
  try {
    due = await loadDue(req.params.token);
  } catch (err) {
    log("[Pay] Lookup failed:", err.message);
    return res.status(500).type("html").send(page({
      title: "Something went wrong",
      body: `<h1>Something went wrong</h1><p class="sub">Please try again in a moment.</p>`,
    }));
  }

  if (!due) {
    return res.status(404).type("html").send(page({
      title: "Link not found",
      body: `<h1>Payment link not found</h1>
             <p class="sub">This link is invalid or has expired. Please ask your
             society office for a fresh one.</p>`,
    }));
  }

  const unit = [due.tower_name, due.unit_number].filter(Boolean).join(" · ") || "—";
  const dueDate = due.due_date
    ? new Date(due.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const header = `<h1>${esc(due.society_name)}</h1>
    <p class="sub">Maintenance · ${esc(due.due_month)}</p>`;

  const details = `<div class="rows">
      <div class="row"><span>Resident</span><span>${esc(due.resident_name)}</span></div>
      <div class="row"><span>Unit</span><span>${esc(unit)}</span></div>
      <div class="row"><span>Month</span><span>${esc(due.due_month)}</span></div>
      <div class="row"><span>Due date</span><span>${esc(dueDate)}</span></div>
    </div>`;

  // ── Already settled ────────────────────────────────────────────────────────
  if (due.status === "PAID" || due.status === "WAIVED") {
    const paidOn = due.payment_date
      ? new Date(due.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : null;
    return res.type("html").send(page({
      title: `Paid — ${due.society_name}`,
      body: `${header}
        <div class="banner ok"><strong>${due.status === "PAID" ? "Payment received" : "Waived"}</strong>${
          paidOn ? `<br>Confirmed on ${esc(paidOn)}` : ""
        }${due.payment_reference ? `<br>Ref: ${esc(due.payment_reference)}` : ""}</div>
        <div class="amount">₹${inr(due.amount)}</div>
        ${details}
        <p class="foot">Nothing further is due for this month.</p>`,
    }));
  }

  // ── Awaiting the secretary's confirmation ──────────────────────────────────
  if (due.status === "PENDING_VERIFICATION") {
    return res.type("html").send(page({
      title: `Confirming — ${due.society_name}`,
      body: `${header}
        <div class="banner warn"><strong>Payment reported — awaiting confirmation</strong><br>
          Your society office is matching UTR <strong>${esc(due.claimed_utr || "—")}</strong>
          against their bank statement. You'll be notified once it's confirmed.</div>
        <div class="amount">₹${inr(due.amount)}</div>
        ${details}
        <p class="foot">Paid by mistake or entered the wrong reference?<br>
        Contact your society office.</p>`,
    }));
  }

  // ── Payable ────────────────────────────────────────────────────────────────
  const payeeName = due.maintenance_payee_name || due.society_name;
  const upiUri = buildUpiUri({
    vpa:       due.maintenance_upi_id,
    payeeName,
    amount:    due.amount,
    note:      `Maintenance ${due.due_month} ${due.unit_number || ""}`.trim(),
    txnRef:    `NEXSO${due.id}`,
  });

  if (!upiUri) {
    return res.type("html").send(page({
      title: `Pay — ${due.society_name}`,
      body: `${header}
        <div class="amount">₹${inr(due.amount)}</div>
        ${details}
        <div class="banner warn">Online payment isn't set up for this society yet.
        Please contact your society office to pay.</div>`,
    }));
  }

  const qr    = await buildQrDataUri(upiUri);
  const apps  = buildAppLinks(upiUri);
  const error = req.query.error;

  const errorBanner = error === "utr"
    ? `<p class="err">That doesn't look like a valid UPI reference number. It's usually 12 digits — check your UPI app's transaction details.</p>`
    : "";

  res.type("html").send(page({
    title: `Pay ₹${inr(due.amount)} — ${due.society_name}`,
    body: `${header}
      <div class="amount">₹${inr(due.amount)}</div>
      <p class="sub">Due ${esc(dueDate)}</p>
      ${details}

      <a class="btn" href="${esc(upiUri)}">Pay ₹${inr(due.amount)} via UPI</a>
      <div class="apps">
        <a href="${esc(apps.gpay)}">GPay</a>
        <a href="${esc(apps.phonepe)}">PhonePe</a>
        <a href="${esc(apps.paytm)}">Paytm</a>
      </div>

      ${qr ? `<div class="divider">or scan to pay</div>
        <div class="qr"><img src="${qr}" alt="UPI QR code"></div>` : ""}
      <div class="vpa">${esc(due.maintenance_upi_id)}</div>

      <div class="divider">after paying</div>
      <form method="POST" action="/pay/${esc(req.params.token)}/claim">
        <label for="utr">Enter the UPI reference / UTR number from your payment app</label>
        <input id="utr" name="utr" inputmode="latin" autocomplete="off"
               placeholder="e.g. 412345678901" required>
        ${errorBanner}
        <button class="btn secondary" type="submit">I've paid — submit reference</button>
      </form>

      <p class="foot">Your society office will match this against their bank
      statement and confirm.<br>Powered by Nexso</p>`,
  }));
});

// ── POST /pay/:token/claim ────────────────────────────────────────────────────

router.post("/:token/claim", async (req, res) => {
  const token = req.params.token;

  try {
    const due = await loadDue(token);
    if (!due) return res.status(404).type("html").send(page({
      title: "Link not found",
      body: `<h1>Payment link not found</h1><p class="sub">This link is invalid or has expired.</p>`,
    }));

    // Nothing to claim against — bounce back to the page, which will explain.
    if (due.status !== "PENDING" && due.status !== "OVERDUE") {
      return res.redirect(303, `/pay/${token}`);
    }

    const utr = normaliseUtr(req.body?.utr);
    if (!utr) return res.redirect(303, `/pay/${token}?error=utr`);

    // Guard against the same reference being reused across dues in this society.
    const dupe = await dbQuery(
      `SELECT id FROM maintenance_dues
        WHERE society_id = $1 AND claimed_utr = $2 AND id <> $3`,
      [due.society_id, utr, due.id],
    );
    if (dupe?.rows?.length) return res.redirect(303, `/pay/${token}?error=utr`);

    await dbQuery(
      `UPDATE maintenance_dues
          SET status = 'PENDING_VERIFICATION',
              claimed_utr = $1, claimed_at = NOW(),
              payment_mode = 'UPI', updated_at = NOW()
        WHERE id = $2`,
      [utr, due.id],
    );

    log(`[Pay] Due #${due.id} claimed by resident — UTR ${utr}, awaiting verification`);

    // Nudge the secretary so verification isn't gated on them opening the app.
    notifySecretaries(due, utr).catch((e) => log("[Pay] Secretary notify failed:", e.message));

    return res.redirect(303, `/pay/${token}`);
  } catch (err) {
    log("[Pay] Claim failed:", err.message);
    return res.status(500).type("html").send(page({
      title: "Something went wrong",
      body: `<h1>Something went wrong</h1>
             <p class="sub">Your payment may still have gone through — please contact
             your society office rather than paying again.</p>`,
    }));
  }
});

/** WhatsApp the society's contact that a payment is waiting to be verified. */
async function notifySecretaries(due, utr) {
  const r = await dbQuery(
    `SELECT contact_phone FROM societies WHERE id = $1`,
    [due.society_id],
  );
  const phone = r?.rows?.[0]?.contact_phone;
  if (!phone) return;

  const unit = [due.tower_name, due.unit_number].filter(Boolean).join(" ") || "—";
  const msg =
    `💰 *Payment to verify*\n\n` +
    `${due.resident_name} (${unit}) has reported paying ` +
    `₹${inr(due.amount)} for ${due.due_month}.\n\n` +
    `UTR: *${utr}*\n\n` +
    `Check your bank statement and confirm it in Nexso → Payments.`;

  await sendWhatsAppText(phone, msg);
}

export default router;
