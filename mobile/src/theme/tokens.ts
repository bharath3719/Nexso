/**
 * tokens.ts — Nexso mobile design tokens.
 *
 * The colour VALUES here are the same ones the web portal uses
 * (frontend/src/styles/cssConstants.js → BRAND, and typography.js → PALETTE).
 * Keep them in step so the two clients read as one product.
 *
 * The SHAPES are deliberately different. The web files export CSS objects with
 * `lineHeight: "20px"` strings and `background: "linear-gradient(...)"` — neither
 * is valid in React Native, where lineHeight is a unitless number and gradients
 * need a dedicated component. So this is a port, not a copy.
 */

// ─── Brand palette ────────────────────────────────────────────────────────────
// Mirrors BRAND in frontend/src/styles/cssConstants.js.
export const BRAND = {
  blue: '#3b82f6',
  indigo: '#6366f1',
  green: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  dark: '#1e293b',
  border: '#e2e8f0',
  surface: '#f8fafc',
} as const;

// ─── Semantic colours ─────────────────────────────────────────────────────────
export const COLORS = {
  // Text — mirrors PALETTE in frontend/src/styles/typography.js
  textPrimary: '#1e293b',
  textBody: '#334155',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  textDisabled: '#cbd5e1',
  textOnAccent: '#ffffff',

  // Surfaces
  screen: '#f1f5f9',
  card: '#ffffff',
  cardMuted: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  divider: '#f1f5f9',

  // Accent
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  primaryTint: '#eff6ff',

  // Feedback
  success: '#16a34a',
  successTint: '#f0fdf4',
  warning: '#d97706',
  warningTint: '#fff7ed',
  danger: '#dc2626',
  dangerTint: '#fef2f2',
  info: '#2563eb',
  infoTint: '#eff6ff',
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// 4pt grid. Use these instead of raw numbers so screens stay rhythmically even.
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * Card elevation. iOS reads the shadow* properties, Android reads `elevation`
 * only — both are set so a card looks lifted on either platform.
 */
export const SHADOW = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ─── Status colour maps ───────────────────────────────────────────────────────
// One entry per value the API can return. `label` is the display string, so
// screens never hand-format an enum.

export type Tone = { bg: string; fg: string; label: string };

/** Ticket / complaint statuses — DB CHECK constraint allows exactly these. */
export const TICKET_STATUS: Record<string, Tone> = {
  OPEN: { bg: '#fef2f2', fg: '#b91c1c', label: 'Open' },
  ASSIGNED: { bg: '#fff7ed', fg: '#b45309', label: 'Assigned' },
  IN_PROGRESS: { bg: '#eff6ff', fg: '#1d4ed8', label: 'In Progress' },
  RESOLVED: { bg: '#f0fdf4', fg: '#15803d', label: 'Resolved' },
  CLOSED: { bg: '#f8fafc', fg: '#334155', label: 'Closed' },
};

/**
 * Maintenance due statuses.
 * PENDING_VERIFICATION is the UPI rail's waiting room — the resident has
 * declared a UTR and the secretary has not confirmed it yet. Only PENDING is
 * ever auto-flipped to OVERDUE, so a resident awaiting confirmation is never
 * shown as late.
 */
export const DUE_STATUS: Record<string, Tone> = {
  PENDING: { bg: '#fffbeb', fg: '#b45309', label: 'Pending' },
  PENDING_VERIFICATION: { bg: '#eff6ff', fg: '#1d4ed8', label: 'Awaiting Confirmation' },
  PAID: { bg: '#f0fdf4', fg: '#15803d', label: 'Paid' },
  OVERDUE: { bg: '#fef2f2', fg: '#b91c1c', label: 'Overdue' },
  WAIVED: { bg: '#f5f3ff', fg: '#6d28d9', label: 'Waived' },
};

/** Announcement priority — mirrors ANNOUNCEMENT_PRIORITY_COLORS on the web. */
export const PRIORITY: Record<string, Tone> = {
  URGENT: { bg: '#fee2e2', fg: '#991b1b', label: 'Urgent' },
  NORMAL: { bg: '#f1f5f9', fg: '#475569', label: 'Normal' },
};

/** Visitor pass statuses. */
export const PASS_STATUS: Record<string, Tone> = {
  ACTIVE: { bg: '#f0fdf4', fg: '#15803d', label: 'Active' },
  USED: { bg: '#f1f5f9', fg: '#475569', label: 'Used' },
  EXPIRED: { bg: '#f8fafc', fg: '#64748b', label: 'Expired' },
  REVOKED: { bg: '#fef2f2', fg: '#b91c1c', label: 'Revoked' },
};

const NEUTRAL_TONE: Tone = { bg: '#f1f5f9', fg: '#475569', label: '—' };

/**
 * Looks a status up in a tone map without ever returning undefined — an
 * unrecognised status renders as a neutral pill showing the raw value rather
 * than crashing the row it sits in.
 */
export function toneFor(map: Record<string, Tone>, status?: string | null): Tone {
  if (!status) return NEUTRAL_TONE;
  return map[status] ?? { ...NEUTRAL_TONE, label: status.replace(/_/g, ' ') };
}
