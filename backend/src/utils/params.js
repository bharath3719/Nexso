/**
 * utils/params.js
 * ───────────────
 * Coercion helpers for untrusted query/body input.
 *
 * The rule these exist to enforce: never let a user-supplied string reach
 * Postgres or `Date` unchecked. `Number("abc")` is NaN, and node-postgres
 * serialises NaN as the literal "NaN" — so `?limit=abc` became
 * `LIMIT 'NaN'` → 500. Same story for `new Date("2026-1").toISOString()`,
 * which throws RangeError on an Invalid Date.
 */

/** Bounded positive integer, falling back to `def` for anything non-numeric. */
export function toLimit(raw, def, max) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

/** Non-negative integer offset; anything else becomes 0. */
export function toOffset(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** The current month as 'YYYY-MM'. */
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/** True for a well-formed 'YYYY-MM' with a real month number. */
export function isValidMonth(raw) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}$/.test(raw)) return false;
  const mon = Number(raw.slice(5, 7));
  return mon >= 1 && mon <= 12;
}

/** A validated 'YYYY-MM', or the current month when absent/malformed. */
export function toMonth(raw) {
  return isValidMonth(raw) ? raw : currentMonth();
}

/** A validated 'YYYY' string, or null when absent/malformed. */
export function toYear(raw) {
  return typeof raw === "string" && /^\d{4}$/.test(raw) ? raw : null;
}

/**
 * The month before `month` ('YYYY-MM' → 'YYYY-MM'), computed on the calendar
 * rather than via Date arithmetic. `new Date("2026-03-01")` parses as UTC but
 * `setMonth` reads local fields, so the old approach returned the wrong month
 * in any timezone west of UTC.
 */
export function previousMonth(month) {
  const safe = toMonth(month);
  const year = Number(safe.slice(0, 4));
  const mon  = Number(safe.slice(5, 7));
  return mon === 1
    ? `${year - 1}-12`
    : `${year}-${String(mon - 1).padStart(2, "0")}`;
}

/**
 * Due date for a month, clamped to the last day so a due_day of 31 doesn't
 * silently roll a February bill into March — Date.UTC(2026, 1, 31) is Mar 3.
 *
 * @returns {string|null} 'YYYY-MM-DD', or null if the month is unusable
 */
export function dueDateFor(month, dueDay) {
  if (!isValidMonth(month)) return null;
  const year = Number(month.slice(0, 4));
  const mon  = Number(month.slice(5, 7));

  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const day     = Math.min(Math.max(Math.floor(Number(dueDay)) || 1, 1), lastDay);

  return `${month}-${String(day).padStart(2, "0")}`;
}
