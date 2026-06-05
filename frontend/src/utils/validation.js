/**
 * validation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared field-level validators used across all forms in the app.
 * Every function returns an error string on failure, or null on success.
 * Returning null for an empty value lets the caller decide whether the field
 * is required — these validators only check FORMAT, not presence.
 */

function stripIndianPhone(value) {
  const stripped = String(value).trim().replace(/[\s\-.()]/g, "");
  let digits = stripped;
  if (digits.startsWith("+91"))       digits = digits.slice(3);
  else if (/^91\d{10}$/.test(digits)) digits = digits.slice(2);
  return digits;
}

/**
 * validatePhone(value) → error string | null
 *
 * Accepts:
 *   9876543210           plain 10-digit mobile
 *   +91 9876543210       E.164 with +91 prefix (spaces/dashes OK)
 *   91 9876543210        12-digit without the +
 *
 * Returns null when the value is blank (pair with a separate required-check).
 */
export function validatePhone(value) {
  if (!value || !String(value).trim()) return null;
  if (!/^\d{10}$/.test(stripIndianPhone(value))) {
    return "Enter a valid 10-digit mobile number (e.g. 9876543210 or +91 98765 43210)";
  }
  return null;
}

/**
 * validateEmail(value) → error string | null
 *
 * Returns null when the value is blank.
 */
export function validateEmail(value) {
  if (!value || !String(value).trim()) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
    return "Enter a valid email address (e.g. user@example.com)";
  }
  return null;
}

/**
 * validateWhatsApp(value) → error string | null
 *
 * Same rules as phone — WhatsApp numbers follow the same format.
 * Alias kept separate so callers can show "WhatsApp number" in the message.
 */
export function validateWhatsApp(value) {
  if (!value || !String(value).trim()) return null;
  if (!/^\d{10}$/.test(stripIndianPhone(value))) {
    return "Enter a valid 10-digit WhatsApp number (e.g. 9876543210 or +91 98765 43210)";
  }
  return null;
}
