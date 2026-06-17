/**
 * cssConstants.js — Visual / styling constants
 * ─────────────────────────────────────────────
 * Colour palettes, tone maps, and gradient tables used across components.
 * Pure data — no logic, no JSX, no side-effects.
 *
 * Import only what you need:
 *   import { cardTones, TOWER_GRADIENTS, VENDOR_STATUS_META } from "../styles/cssConstants.js";
 */

// ─── Brand palette ────────────────────────────────────────────────────────────
// Single source of truth for the raw hex values used in dynamic inline styles
// and JS-driven CSS (gradients, avatar hues, etc.).
// Static, text-colour tokens live in typography.js → PALETTE.
export const BRAND = {
  blue:   "#3b82f6",
  indigo: "#6366f1",
  green:  "#10b981",
  amber:  "#f59e0b",
  rose:   "#f43f5e",
  slate:  "#64748b",
  dark:   "#1e293b",
  border: "#e2e8f0",
  surface: "#f8fafc",
};

// ─── Card tones ───────────────────────────────────────────────────────────────
// Used by StatsCards to colour each KPI card by ticket status.
// Keys match ticketStatuses[].key values plus the synthetic "total" card.
export const cardTones = {
  total: {
    accent:      BRAND.blue,
    valueColor:  "#1d4ed8",
    labelColor:  "#34507a",
    hintColor:   "#5f7aa4",
    background:  "linear-gradient(135deg, #eef5ff 0%, #ffffff 100%)",
    borderColor: "rgba(59, 130, 246, 0.22)",
  },
  OPEN: {
    accent:      "#dc2626",
    valueColor:  "#b91c1c",
    labelColor:  "#7f1d1d",
    hintColor:   "#a63b3b",
    background:  "linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)",
    borderColor: "rgba(220, 38, 38, 0.22)",
  },
  ASSIGNED: {
    accent:      "#d97706",
    valueColor:  "#b45309",
    labelColor:  "#7c4a03",
    hintColor:   "#9a6700",
    background:  "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
    borderColor: "rgba(217, 119, 6, 0.22)",
  },
  IN_PROGRESS: {
    accent:      "#2563eb",
    valueColor:  "#1d4ed8",
    labelColor:  "#1e3a8a",
    hintColor:   "#4361b5",
    background:  "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  RESOLVED: {
    accent:      "#16a34a",
    valueColor:  "#15803d",
    labelColor:  "#14532d",
    hintColor:   "#337a4f",
    background:  "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
    borderColor: "rgba(22, 163, 74, 0.22)",
  },
  CLOSED: {
    accent:      "#475569",
    valueColor:  "#334155",
    labelColor:  "#334155",
    hintColor:   "#64748b",
    background:  "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    borderColor: "rgba(71, 85, 105, 0.18)",
  },
};

// ─── Vendor status meta ───────────────────────────────────────────────────────
// Shared between VendorDetail and Vendors (previously duplicated in both).
// bg / color are dynamic → stay inline on StatusBadge; label is the display text.
export const VENDOR_STATUS_META = {
  APPROVED:             { bg: "#d1fae5", color: "#065f46", label: "Approved"             },
  VERIFICATION_PENDING: { bg: "#fef3c7", color: "#92400e", label: "Pending Verification"  },
  REJECTED:             { bg: "#fee2e2", color: "#991b1b", label: "Rejected"              },
  SUSPENDED:            { bg: "#ffedd5", color: "#9a3412", label: "Suspended"             },
  INACTIVE:             { bg: "#f1f5f9", color: "#475569", label: "Inactive"              },
};

// ─── Society type colours ─────────────────────────────────────────────────────
// Used by SocietyCard type-badge (bg/text/border are dynamic → stay inline).
// Labels live in constants.js (domain data, not styling).
export const SOCIETY_TYPE_COLORS = {
  APARTMENT:       { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  GATED_COMMUNITY: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  COMMERCIAL:      { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  MIXED_USE:       { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
};

// ─── Announcement priority colours ───────────────────────────────────────────
// bg / color are runtime-looked-up → must stay inline; defined here as the
// single source of truth.
export const ANNOUNCEMENT_PRIORITY_COLORS = {
  URGENT: { bg: "#fee2e2", color: "#991b1b" },
  NORMAL: { bg: "#f1f5f9", color: "#475569" },
};

// ─── Tower gradients ──────────────────────────────────────────────────────────
// Cycled by index to colour tower cards in SocietyDetailPage.
// Each entry is [startColour, endColour].
export const TOWER_GRADIENTS = [
  ["#3b82f6", "#6366f1"],
  ["#10b981", "#06b6d4"],
  ["#f59e0b", "#ef4444"],
  ["#8b5cf6", "#ec4899"],
  ["#06b6d4", "#3b82f6"],
  ["#ef4444", "#f97316"],
];
