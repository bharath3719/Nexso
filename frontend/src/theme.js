import { createTheme } from "@fluentui/react";

export const shellTheme = createTheme({
  palette: {
    themePrimary:         "#3b82f6",
    themeLighterAlt:      "#0a1a33",
    themeLighter:         "#153b73",
    themeLight:           "#1f56aa",
    themeTertiary:        "#2f7ae5",
    themeSecondary:       "#4393ff",
    themeDarkAlt:         "#4f91f7",
    themeDark:            "#6aa6fa",
    themeDarker:          "#92c0fb",
    neutralLighterAlt:    "#f8f8f8",
    neutralLighter:       "#f4f4f4",
    neutralLight:         "#eaeaea",
    neutralQuaternaryAlt: "#d6d6d6",
    neutralQuaternary:    "#cccccc",
    neutralTertiaryAlt:   "#c4c4c4",
    neutralTertiary:      "#a6a6a6",
    neutralSecondary:     "#666666",
    neutralPrimaryAlt:    "#3c3c3c",
    neutralPrimary:       "#323130",
    neutralDark:          "#201f1f",
    black:                "#000000",
    white:                "#ffffff",
  },
  fonts: {
    medium: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
    large:  { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
    xLarge: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
  },
});

// ─── Shared DetailsList styles ────────────────────────────────────────────────
export const listStyles = {
  root: { background: "transparent", overflowX: "auto" },
  headerWrapper: {
    paddingTop: 0,
    selectors: {
      ".ms-DetailsHeader":          { paddingTop: 0, height: 36, lineHeight: "36px" },
      ".ms-DetailsHeader-cell":     { height: 36, lineHeight: "36px" },
      ".ms-DetailsHeader-cellTitle": { lineHeight: "36px" },
    },
  },
  contentWrapper: {
    paddingTop: 0,
    selectors: {
      ".ms-DetailsRow":             { minHeight: 36 },
      ".ms-DetailsRow-cell":        { height: 36, paddingTop: 0, paddingBottom: 0, display: "flex", alignItems: "center" },
      ".ms-DetailsRow-cellCheck":   { height: 36 },
    },
  },
};

// ─── Shared button style objects ──────────────────────────────────────────────

/**
 * Filter-toggle icon button used in page headers (Dashboard, Users, Complaints).
 * Height/width kept at 28 × 28 to match the adjacent PageHeader row height.
 */
export const filterIconButtonStyles = {
  root: {
    height: 28,
    width:  28,
    color:  shellTheme.palette.themePrimary,
  },
};

// ─── Login screen styles ──────────────────────────────────────────────────────
// Extracted from App.jsx LoginScreen so the JSX stays markup-only.

export const loginScreenStyles = {
  /** Full-viewport centred background */
  outer: {
    root: { background: "#f5f7fa", padding: 16 },
  },
  /** White card holding the form */
  card: {
    root: {
      width:     380,
      maxWidth:  "90vw",
      background: "#fff",
      padding:   24,
      borderRadius: 12,
      boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
    },
  },
  /** "Nexso Login" heading */
  title: {
    root: { fontWeight: 700, textAlign: "center" },
  },
  /** "Sign in to continue." sub-heading */
  subtitle: {
    root: { color: "#5f6a7a", textAlign: "center" },
  },
  /** Dev-mode credential hint */
  hint: {
    root: { color: "#7a8698", textAlign: "center" },
  },
};
