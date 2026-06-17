/**
 * Nexso Design System — Typography
 * ─────────────────────────────────
 * Built on the Microsoft Fluent 2 type ramp.
 * Spec: https://fluent2.microsoft.design/typography
 *
 * HOW TO USE
 * ──────────
 * Fluent UI <Text> components  →  import { T } from "../styles/typography";
 *                                  <Text styles={T.pageHeader}>…</Text>
 *
 * Plain HTML elements           →  import { CSS_T } from "../styles/typography";
 *                                  <div style={CSS_T.sectionHeader}>…</div>
 *                                  <div style={{ ...CSS_T.sectionHeader, marginTop: 4 }}>…</div>
 *
 * Full Fluent 2 ramp            →  import { RAMP } from "../styles/typography";
 *                                  <div style={RAMP.title3}>…</div>
 *
 * FLUENT 2 TYPE RAMP (Web / Segoe UI Variable)
 * ─────────────────────────────────────────────
 *  display       68 / 92px  / Semibold 600
 *  largeTitle    40 / 52px  / Semibold 600
 *  title1        32 / 40px  / Semibold 600
 *  title2        28 / 36px  / Semibold 600
 *  title3        24 / 32px  / Semibold 600   ← pageHeader
 *  subtitle1     20 / 26px  / Semibold 600   ← modalHeader
 *  subtitle2     16 / 22px  / Semibold 600   ← sectionHeader
 *  body1         14 / 20px  / Regular  400   ← pageSubtitle, body
 *  body1Strong   14 / 20px  / Semibold 600   ← tablePrimary, subSection
 *  caption1      12 / 16px  / Regular  400   ← tableSecondary, infoValue, caption, filterLabel
 *  caption1Strong 12 / 16px / Semibold 600   ← infoLabel
 *  caption2      10 / 14px  / Regular  400
 *
 * APP TOKEN HIERARCHY
 * ────────────────────
 *  pageHeader      — top of every page            28 / 36px  / 700
 *  pageSubtitle    — one line beneath pageHeader   14 / 20px  / 400  muted
 *  sectionHeader   — card/section titles           16 / 22px  / 600
 *  subSection      — inside-card sub-headings      14 / 20px  / 600
 *  modalHeader     — popup / dialog title          20 / 26px  / 700
 *  filterLabel     — filter row "Filter:" label    12 / 16px  / 400  muted
 *  tablePrimary    — main cell text (name)         14 / 20px  / 600
 *  tableSecondary  — muted cell text               12 / 16px  / 400  muted
 *  infoLabel       — detail popup row labels       12 / 16px  / 600  muted  (min-width 130)
 *  infoValue       — detail popup row values       12 / 16px  / 400
 *  caption         — helper / timestamp text       12 / 16px  / 400  very muted
 */

// ─── Font Families ────────────────────────────────────────────────────────────
const FONT_FAMILY =
  "\"Segoe UI Variable\", \"Segoe UI\", -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", sans-serif";

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = {
  textPrimary:   "#1e293b",   // headings, bold body text
  textBody:      "#334155",   // regular body text
  textSecondary: "#64748b",   // subtitles, filter labels, muted body
  textMuted:     "#94a3b8",   // captions, info-row labels
  textDisabled:  "#cbd5e1",
};

// ─── RAMP — full Fluent 2 type ramp as plain CSS objects ─────────────────────
// Usage: <div style={RAMP.subtitle1}>…</div>
const RAMP = {
  display: {
    fontFamily:  FONT_FAMILY,
    fontSize:    68,
    lineHeight:  "92px",
    fontWeight:  600,
  },
  largeTitle: {
    fontFamily:  FONT_FAMILY,
    fontSize:    40,
    lineHeight:  "52px",
    fontWeight:  600,
  },
  title1: {
    fontFamily:  FONT_FAMILY,
    fontSize:    32,
    lineHeight:  "40px",
    fontWeight:  600,
  },
  title2: {
    fontFamily:  FONT_FAMILY,
    fontSize:    28,
    lineHeight:  "36px",
    fontWeight:  600,
  },
  title3: {
    fontFamily:  FONT_FAMILY,
    fontSize:    24,
    lineHeight:  "32px",
    fontWeight:  600,
  },
  subtitle1: {
    fontFamily:  FONT_FAMILY,
    fontSize:    20,
    lineHeight:  "26px",
    fontWeight:  600,
  },
  subtitle2: {
    fontFamily:  FONT_FAMILY,
    fontSize:    16,
    lineHeight:  "22px",
    fontWeight:  600,
  },
  body1: {
    fontFamily:  FONT_FAMILY,
    fontSize:    14,
    lineHeight:  "20px",
    fontWeight:  400,
  },
  body1Strong: {
    fontFamily:  FONT_FAMILY,
    fontSize:    14,
    lineHeight:  "20px",
    fontWeight:  600,
  },
  body1Stronger: {
    fontFamily:  FONT_FAMILY,
    fontSize:    14,
    lineHeight:  "20px",
    fontWeight:  700,
  },
  caption1: {
    fontFamily:  FONT_FAMILY,
    fontSize:    12,
    lineHeight:  "16px",
    fontWeight:  400,
  },
  caption1Strong: {
    fontFamily:  FONT_FAMILY,
    fontSize:    12,
    lineHeight:  "16px",
    fontWeight:  600,
  },
  caption2: {
    fontFamily:  FONT_FAMILY,
    fontSize:    10,
    lineHeight:  "14px",
    fontWeight:  400,
  },
};

// ─── T — Fluent UI <Text styles={T.xxx}> objects ─────────────────────────────
export const T = {
  // Title 2 — 28/36px bold  (page-level prominence)
  pageHeader: {
    root: {
      fontFamily:    FONT_FAMILY,
      fontSize:      28,
      fontWeight:    700,
      color:         PALETTE.textPrimary,
      lineHeight:    "36px",
      letterSpacing: "-0.4px",
    },
  },

  // Body 1 — 14/20px regular
  pageSubtitle: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   14,
      fontWeight: 400,
      color:      PALETTE.textSecondary,
      lineHeight: "20px",
    },
  },

  // Subtitle 2 — 16/22px semibold
  sectionHeader: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   16,
      fontWeight: 600,
      color:      PALETTE.textPrimary,
      lineHeight: "22px",
    },
  },

  // Body 1 Strong — 14/20px semibold
  subSection: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   14,
      fontWeight: 600,
      color:      PALETTE.textBody,
      lineHeight: "20px",
    },
  },

  // Subtitle 1 — 20/26px bold
  modalHeader: {
    root: {
      fontFamily:    FONT_FAMILY,
      fontSize:      20,
      fontWeight:    700,
      color:         PALETTE.textPrimary,
      lineHeight:    "26px",
      letterSpacing: "-0.2px",
    },
  },

  // Caption 1 — 12/16px regular muted
  filterLabel: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   12,
      fontWeight: 400,
      color:      PALETTE.textSecondary,
      lineHeight: "16px",
    },
  },

  // Body 1 Strong — 14/20px semibold
  tablePrimary: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   14,
      fontWeight: 600,
      color:      PALETTE.textPrimary,
      lineHeight: "20px",
    },
  },

  // Caption 1 — 12/16px regular muted
  tableSecondary: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   12,
      fontWeight: 400,
      color:      PALETTE.textSecondary,
      lineHeight: "16px",
    },
  },

  // Caption 1 Strong — 12/16px semibold muted
  infoLabel: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   12,
      fontWeight: 600,
      color:      PALETTE.textMuted,
      lineHeight: "16px",
      minWidth:   130,
    },
  },

  // Caption 1 — 12/16px regular
  infoValue: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   12,
      fontWeight: 400,
      color:      PALETTE.textPrimary,
      lineHeight: "16px",
    },
  },

  // Caption 1 — 12/16px regular very muted
  caption: {
    root: {
      fontFamily: FONT_FAMILY,
      fontSize:   12,
      fontWeight: 400,
      color:      PALETTE.textMuted,
      lineHeight: "16px",
    },
  },

  // Caption 2 bold uppercase — 11/16px semibold muted uppercase (overline / section label)
  // Use for "TOWERS", "① Select Unit", picker section headings, etc.
  overline: {
    root: {
      fontFamily:    FONT_FAMILY,
      fontSize:      11,
      fontWeight:    700,
      color:         PALETTE.textMuted,
      lineHeight:    "16px",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
  },
};

// ─── CSS_T — plain style objects for non-Fluent HTML elements ────────────────
// Usage: <div style={CSS_T.sectionHeader}>  or  <div style={{ ...CSS_T.sectionHeader, marginTop: 8 }}>
export const CSS_T = {
  // Title 2 bold
  pageHeader: {
    fontFamily:    FONT_FAMILY,
    fontSize:      28,
    fontWeight:    700,
    color:         PALETTE.textPrimary,
    lineHeight:    "36px",
    letterSpacing: "-0.4px",
  },

  // Body 1 regular
  pageSubtitle: {
    fontFamily: FONT_FAMILY,
    fontSize:   14,
    fontWeight: 400,
    color:      PALETTE.textSecondary,
    lineHeight: "20px",
  },

  // Subtitle 2 semibold
  sectionHeader: {
    fontFamily: FONT_FAMILY,
    fontSize:   16,
    fontWeight: 600,
    color:      PALETTE.textPrimary,
    lineHeight: "22px",
  },

  // Body 1 Strong semibold
  subSection: {
    fontFamily: FONT_FAMILY,
    fontSize:   14,
    fontWeight: 600,
    color:      PALETTE.textBody,
    lineHeight: "20px",
  },

  // Subtitle 1 bold
  modalHeader: {
    fontFamily:    FONT_FAMILY,
    fontSize:      20,
    fontWeight:    700,
    color:         PALETTE.textPrimary,
    lineHeight:    "26px",
    letterSpacing: "-0.2px",
  },

  // Caption 1 regular muted
  filterLabel: {
    fontFamily: FONT_FAMILY,
    fontSize:   12,
    fontWeight: 400,
    color:      PALETTE.textSecondary,
    lineHeight: "16px",
  },

  // Body 1 regular
  body: {
    fontFamily: FONT_FAMILY,
    fontSize:   14,
    fontWeight: 400,
    color:      PALETTE.textBody,
    lineHeight: "20px",
  },

  // Body 1 regular muted
  bodyMuted: {
    fontFamily: FONT_FAMILY,
    fontSize:   14,
    fontWeight: 400,
    color:      PALETTE.textSecondary,
    lineHeight: "20px",
  },

  // Caption 1 regular very muted
  caption: {
    fontFamily: FONT_FAMILY,
    fontSize:   12,
    fontWeight: 400,
    color:      PALETTE.textMuted,
    lineHeight: "16px",
  },
};
