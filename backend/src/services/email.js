/**
 * services/email.js
 * ──────────────────
 * Transactional email via Nodemailer (SMTP).
 *
 * Supported providers (set in .env):
 *   Gmail  — EMAIL_HOST=smtp.gmail.com  EMAIL_PORT=465  EMAIL_SECURE=true
 *            Use an App Password, not your Gmail password.
 *   Outlook — EMAIL_HOST=smtp.office365.com  EMAIL_PORT=587  EMAIL_SECURE=false
 *   Any SMTP — set EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE / EMAIL_USER / EMAIL_PASS
 *
 * If EMAIL_USER / EMAIL_PASS are not set, sending is skipped (logged only).
 */

import nodemailer from "nodemailer";
import { log } from "../utils/logger.js";

// ── Create transporter (lazy, once) ───────────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user   = process.env.EMAIL_USER;
  const pass   = process.env.EMAIL_PASS;
  const host   = process.env.EMAIL_HOST   || "smtp.gmail.com";
  const port   = Number(process.env.EMAIL_PORT   || 465);
  const secure = process.env.EMAIL_SECURE !== "false"; // default true (SSL)

  if (!user || !pass) {
    log("Email: EMAIL_USER or EMAIL_PASS not set — email sending disabled.");
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return _transporter;
}

// ── From address ──────────────────────────────────────────────────────────────

function fromAddress() {
  const name = process.env.EMAIL_FROM_NAME || "Nexso";
  const addr = process.env.EMAIL_USER;
  return `"${name}" <${addr}>`;
}

// ── HTML email template ───────────────────────────────────────────────────────

function buildMaintenanceReminderHtml({
  residentName,
  societyName,
  amount,
  dueMonth,
  dueDate,
  upiId,
  paymentLink,
}) {
  const amountFmt  = Number(amount).toLocaleString("en-IN");
  const dueDateFmt = new Date(dueDate).toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Maintenance Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#fff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);
                       padding:28px 32px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">
                🏢 Nexso
              </div>
              <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">
                Society Management Platform
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1e293b;">
                Dear <strong>${residentName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
                This is a friendly reminder that your monthly maintenance fee
                for <strong>${societyName}</strong> is due soon.
              </p>

              <!-- Amount box -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
                          padding:20px 24px;margin-bottom:24px;text-align:center;">
                <div style="font-size:13px;color:#3b82f6;font-weight:600;
                            text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
                  Amount Due
                </div>
                <div style="font-size:36px;font-weight:800;color:#1e40af;">
                  ₹${amountFmt}
                </div>
                <div style="font-size:13px;color:#64748b;margin-top:4px;">
                  for ${dueMonth}
                </div>
              </div>

              <!-- Due date -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 20px;border-right:1px solid #e2e8f0;width:50%;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;
                                text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
                      Due Date
                    </div>
                    <div style="font-size:15px;font-weight:700;color:#1e293b;">
                      ${dueDateFmt}
                    </div>
                  </td>
                  <td style="padding:14px 20px;width:50%;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;
                                text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
                      Month
                    </div>
                    <div style="font-size:15px;font-weight:700;color:#1e293b;">
                      ${dueMonth}
                    </div>
                  </td>
                </tr>
              </table>

              ${paymentLink ? `
              <!-- Razorpay Pay Now CTA -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${paymentLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);
                          color:#fff;text-decoration:none;font-size:16px;font-weight:700;
                          padding:14px 40px;border-radius:8px;letter-spacing:0.02em;
                          box-shadow:0 4px 12px rgba(37,99,235,0.35);">
                  💳 Pay Now
                </a>
                <div style="font-size:12px;color:#94a3b8;margin-top:10px;">
                  Secure payment powered by Razorpay
                </div>
              </div>` : ""}

              ${upiId && !paymentLink ? `
              <!-- UPI payment (shown only when no Razorpay link) -->
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                          padding:16px 20px;margin-bottom:24px;">
                <div style="font-size:12px;color:#16a34a;font-weight:600;
                            text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
                  💳 Pay via UPI
                </div>
                <div style="font-size:17px;font-weight:700;color:#166534;
                            font-family:monospace;letter-spacing:0.03em;">
                  ${upiId}
                </div>
                <div style="font-size:12px;color:#4ade80;margin-top:4px;">
                  Open any UPI app (GPay, PhonePe, Paytm) and pay to this ID
                </div>
              </div>` : ""}

              <p style="margin:0 0 8px;font-size:14px;color:#475569;line-height:1.6;">
                Please ensure payment is made before the due date to avoid any
                inconvenience to society services.
              </p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">
                If you have already paid, please ignore this email or contact
                your society secretary.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                       padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated reminder from <strong>${societyName}</strong>
                via Nexso Society Management.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Public: send maintenance reminder email ────────────────────────────────────

/**
 * Sends a maintenance reminder email.
 *
 * @param {object} opts
 * @param {string}  opts.to             Recipient email address
 * @param {string}  opts.residentName
 * @param {string}  opts.societyName
 * @param {number}  opts.amount         Amount in INR
 * @param {string}  opts.dueMonth       'YYYY-MM'
 * @param {string}  opts.dueDate        ISO date string 'YYYY-MM-DD'
 * @param {string}  [opts.upiId]        Optional UPI ID (shown only when no paymentLink)
 * @param {string}  [opts.paymentLink]  Optional Razorpay payment link URL (takes priority over UPI)
 * @returns {Promise<{sent:boolean, skipped?:boolean, error?:string}>}
 */
export async function sendMaintenanceReminderEmail(opts) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, skipped: true };

  const { to, residentName, societyName, amount, dueMonth, dueDate, upiId, paymentLink } = opts;

  const amountFmt  = Number(amount).toLocaleString("en-IN");
  const dueDateFmt = new Date(dueDate).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const subject = `[${societyName}] Maintenance Reminder — ₹${amountFmt} due on ${dueDateFmt}`;

  const html = buildMaintenanceReminderHtml({
    residentName, societyName, amount, dueMonth, dueDate, upiId, paymentLink,
  });

  // Plain-text fallback
  const text =
    `Hi ${residentName},\n\n` +
    `Your monthly maintenance of ₹${amountFmt} for ${dueMonth} is due on ${dueDateFmt}.\n` +
    (paymentLink ? `\nPay online: ${paymentLink}\n` : "") +
    (!paymentLink && upiId ? `\nPay via UPI: ${upiId}\n` : "") +
    `\nPlease pay on time.\n\n— ${societyName} Management`;

  try {
    await transporter.sendMail({
      from:    fromAddress(),
      to,
      subject,
      text,
      html,
    });
    log(`[Email] Maintenance reminder sent to ${to}`);
    return { sent: true };
  } catch (err) {
    log(`[Email] Failed to send to ${to}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

/**
 * Quick connectivity check — resolves true if SMTP credentials are configured.
 */
export function isEmailConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}
