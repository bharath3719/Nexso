/**
 * format.ts — display formatters.
 *
 * Ported from frontend/src/utils/formatDate.js. The web file is pure JS and
 * would run unchanged; it is copied rather than imported because the mobile app
 * is a separate package and the repo is not a workspace monorepo. Keep the two
 * in step — the en-IN locale and ₹ formatting are product decisions, not
 * incidental.
 *
 * Hermes ships full ICU on both platforms in RN 0.86, so toLocaleDateString
 * with an explicit locale is safe here.
 */

/** "2026-06-15" → "15 Jun 2026" */
export function formatDateShort(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "2026-06-15" → "15 Jun" */
export function formatDayMonth(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * "2026-06" → "June 2026".
 * Parsed component-wise in local time: `new Date("2026-06")` is treated as UTC
 * midnight, which rolls back to May for anyone east of Greenwich.
 */
export function formatMonth(m?: string | null): string {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** "2026-06-15T09:30:00Z" → "15 Jun, 09:30 AM" */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** 1234.5 → "₹1,234.50" */
export function formatINR(n?: number | string | null): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 1234.5 → "₹1,235" — for stat tiles, where decimals are noise. */
export function formatINRShort(n?: number | string | null): string {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

/** "2026-06-15T09:30:00Z" → "2h ago" / "3d ago". Falls back to a date past a week. */
export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';

  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;

  return formatDateShort(value);
}

/** Current month as 'YYYY-MM', the format every maintenance endpoint expects. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current year as 'YYYY'. */
export function currentYear(): string {
  return String(new Date().getFullYear());
}

/**
 * Date → 'YYYY-MM-DD' for the ledger endpoints, which store a DATE column.
 * Built from the local components rather than toISOString(), which converts to
 * UTC first and so files an evening entry in India under the previous day.
 */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parses what the API returns for a DATE column back into a local Date.
 *
 * The two forms need opposite handling, and getting it wrong is not cosmetic —
 * the edit form round-trips this value straight back through toISODate, so a
 * one-day error walks the date backwards on every save:
 *
 *  • Full timestamp ('2026-08-18T18:30:00.000Z') — what node-postgres actually
 *    returns for a DATE column, midnight local serialised as UTC. It names an
 *    instant, so `new Date` converts it back to the right local day. Slicing
 *    the first 10 characters would read the UTC day, which is the day BEFORE
 *    anywhere east of Greenwich — India included.
 *  • Bare date ('2026-08-19') — names a calendar day with no zone. `new Date`
 *    reads it as UTC midnight, which lands on the previous day west of
 *    Greenwich, so this one is built from its parts in local time.
 */
export function fromISODate(value?: string | null): Date {
  if (!value) return new Date();

  if (value.includes('T')) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/** Shifts a 'YYYY-MM' string by n months. `addMonths('2026-01', -1)` → '2025-12'. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "Anita Sharma" → "AS". Used for avatar circles. */
export function initials(name?: string | null): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** First name only, for greetings. */
export function firstName(name?: string | null): string {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/**
 * Deterministic pastel background for an avatar, derived from the name so the
 * same person keeps the same colour across screens and sessions.
 */
export function avatarColor(name?: string | null): string {
  const seed = String(name || '?');
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 62%, 88%)`;
}
