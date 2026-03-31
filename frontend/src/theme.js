import { createTheme } from "@fluentui/react";

export const shellTheme = createTheme({
  palette: {
    themePrimary: "#3b82f6",
    themeLighterAlt: "#0a1a33",
    themeLighter: "#153b73",
    themeLight: "#1f56aa",
    themeTertiary: "#2f7ae5",
    themeSecondary: "#4393ff",
    themeDarkAlt: "#4f91f7",
    themeDark: "#6aa6fa",
    themeDarker: "#92c0fb",
    neutralLighterAlt: "#f8f8f8",
    neutralLighter: "#f4f4f4",
    neutralLight: "#eaeaea",
    neutralQuaternaryAlt: "#d6d6d6",
    neutralQuaternary: "#cccccc",
    neutralTertiaryAlt: "#c4c4c4",
    neutralTertiary: "#a6a6a6",
    neutralSecondary: "#666666",
    neutralPrimaryAlt: "#3c3c3c",
    neutralPrimary: "#323130",
    neutralDark: "#201f1f",
    black: "#000000",
    white: "#ffffff",
  },
  fonts: {
    medium: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
    large: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
    xLarge: { fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
  },
});

export const listStyles = {
  root: { background: "transparent", overflowX: "auto" },
  headerWrapper: {
    paddingTop: 0,
    selectors: {
      ".ms-DetailsHeader": { paddingTop: 0, height: 36, lineHeight: "36px" },
      ".ms-DetailsHeader-cell": { height: 36, lineHeight: "36px" },
      ".ms-DetailsHeader-cellTitle": { lineHeight: "36px" },
    },
  },
  contentWrapper: { paddingTop: 0 },
};

export const commandButtonStyles = {
  root: { color: "#fff", background: "transparent" },
  rootHovered: { color: "#fff", background: "rgba(255,255,255,0.08)" },
  rootPressed: { color: "#fff", background: "rgba(255,255,255,0.14)" },
  icon: { color: "#fff" },
  iconHovered: { color: "#fff" },
  iconPressed: { color: "#fff" },
  label: { color: "#fff" },
  labelHovered: { color: "#fff" },
  labelPressed: { color: "#fff" },
};
