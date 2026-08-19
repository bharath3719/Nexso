/**
 * validation.ts — field-level validators.
 *
 * Ported verbatim in behaviour from frontend/src/utils/validation.js: every
 * function returns an error string on failure, or null on success, and returns
 * null for a blank value so the caller decides whether the field is required.
 */

function stripIndianPhone(value: string): string {
  const stripped = String(value).trim().replace(/[\s\-.()]/g, '');
  let digits = stripped;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (/^91\d{10}$/.test(digits)) digits = digits.slice(2);
  return digits;
}

/**
 * Accepts 9876543210, +91 9876543210, or 91 9876543210.
 * Returns null when blank — pair with a separate required-check.
 */
export function validatePhone(value?: string | null): string | null {
  if (!value || !String(value).trim()) return null;
  if (!/^\d{10}$/.test(stripIndianPhone(value))) {
    return 'Enter a valid 10-digit mobile number (e.g. 9876543210)';
  }
  return null;
}

export function validateEmail(value?: string | null): string | null {
  if (!value || !String(value).trim()) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
    return 'Enter a valid email address (e.g. user@example.com)';
  }
  return null;
}

export function validateWhatsApp(value?: string | null): string | null {
  if (!value || !String(value).trim()) return null;
  if (!/^\d{10}$/.test(stripIndianPhone(value))) {
    return 'Enter a valid 10-digit WhatsApp number (e.g. 9876543210)';
  }
  return null;
}

export function required(value: unknown, fieldLabel = 'This field'): string | null {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${fieldLabel} is required`;
  }
  return null;
}

/**
 * Reduces a phone number to the bare 10-digit local form the backend keys on.
 *
 * Mirrors normalizePhone() in backend/src/routes/auth.js, which takes the LAST
 * ten digits rather than stripping a leading 91. That is deliberate there and
 * must stay deliberate here: a valid Indian mobile can itself begin with 91
 * (e.g. 9198765432), and prefix-stripping mangles it into eight digits that
 * match no resident.
 */
export function normalizePhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}
