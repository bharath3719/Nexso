/**
 * onboardingNewStyles.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Shared style objects, factory functions, and interactive event-handlers
 * for the OnboardingNew flow.  Keeps repeated inline-style literals out of
 * component files.
 */

// â”€â”€â”€ Focus / blur helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const onFocusBlue  = (e) => (e.target.style.borderColor = "#3b82f6");
const onBlurBorder = (e) => (e.target.style.borderColor = "#e2e8f0");

// â”€â”€â”€ Inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Full-width plain-HTML text input used inside modals */
const FIELD_INPUT = {
  border:       "1.5px solid #e2e8f0",
  borderRadius: 8,
  padding:      "9px 12px",
  fontSize:     13,
  outline:      "none",
  width:        "100%",
  boxSizing:    "border-box",
  background:   "#fff",
  color:        "#1e293b",
  transition:   "border-color 0.15s",
};

/** FluentUI TextField styles used in Step 1 */
export const INPUT_STYLES = {
  root:       { flex: 1 },
  fieldGroup: { borderRadius: 6, border: "1px solid #e2e8f0" },
};

/** Native number input (NumberField component) */
const NUMBER_INPUT = {
  padding:      "7px 10px",
  border:       "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize:     14,
  fontWeight:   600,
  outline:      "none",
  width:        "100%",
  boxSizing:    "border-box",
};

/** Native text input inside FloorUnitInput */
const FLOOR_UNIT_INPUT = {
  flex:         1,
  padding:      "7px 10px",
  border:       "1.5px solid #e2e8f0",
  borderRadius: 6,
  fontSize:     13,
  outline:      "none",
  background:   "#fff",
  boxSizing:    "border-box",
  transition:   "border-color 0.15s",
  minWidth:     0,
};

/** Native input for editing the floor number in Step 2 */
const FLOOR_NUMBER_INPUT = {
  width:       44,
  padding:     "3px 5px",
  borderRadius: 5,
  border:      "1.5px solid #e2e8f0",
  fontSize:    13,
  fontWeight:  700,
  color:       "#1e293b",
  outline:     "none",
  textAlign:   "center",
  background:  "#fff",
  transition:  "border-color 0.15s",
};

/** Inline input for editing the tower name */
const TOWER_NAME_INPUT = {
  fontSize:     18,
  fontWeight:   700,
  color:        "#1e293b",
  border:       "none",
  borderBottom: "2px solid #e2e8f0",
  outline:      "none",
  background:   "transparent",
  minWidth:     140,
  padding:      "2px 4px",
};

// â”€â”€â”€ Text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Uppercase section label used inside modals (e.g. "â‘  Select Unit") */
const SECTION_LABEL = {
  fontSize:      11,
  fontWeight:    700,
  color:         "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom:  8,
};

/** <label> style for form fields inside modals */
const FORM_LABEL = {
  fontSize:     12,
  color:        "#475569",
  fontWeight:   600,
  display:      "block",
  marginBottom: 4,
};

// â”€â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** FluentUI PrimaryButton styles (nav buttons â€” Next, Finish, etc.) */
export const PRIMARY_BTN = {
  root:  { borderRadius: 8, height: 40, padding: "0 24px" },
  label: { fontWeight: 700 },
};

/** Plain HTML cancel / close button */
const CANCEL_BTN = {
  padding:      "9px 20px",
  borderRadius: 8,
  border:       "1.5px solid #e2e8f0",
  background:   "#fff",
  color:        "#374151",
  fontSize:     13,
  fontWeight:   600,
  cursor:       "pointer",
};

/** "Add First Resident" gradient button */
const ADD_FIRST_BTN = {
  display:    "flex",
  alignItems: "center",
  gap:        7,
  padding:    "10px 20px",
  borderRadius: 8,
  border:     "none",
  background: "linear-gradient(135deg,#1e40af,#3b82f6)",
  color:      "#fff",
  fontSize:   13,
  fontWeight: 700,
  cursor:     "pointer",
};

/** "View Structure" ghost button (empty-state panel) */
const VIEW_STRUCTURE_BTN = {
  display:      "flex",
  alignItems:   "center",
  gap:          7,
  padding:      "10px 18px",
  borderRadius: 8,
  border:       "1.5px solid #bfdbfe",
  background:   "#fff",
  color:        "#3b82f6",
  fontSize:     13,
  fontWeight:   600,
  cursor:       "pointer",
};

/** "Add Another Resident" dashed button */
const ADD_ANOTHER_BTN = {
  display:      "flex",
  alignItems:   "center",
  gap:          7,
  padding:      "9px 18px",
  borderRadius: 8,
  border:       "1.5px dashed #bfdbfe",
  background:   "#f8fafc",
  color:        "#3b82f6",
  fontSize:     13,
  fontWeight:   600,
  cursor:       "pointer",
  width:        "fit-content",
  transition:   "all 0.15s",
};

/** Download Excel template button (green) */
const DOWNLOAD_BTN = {
  display:        "flex",
  flexDirection:  "column",
  alignItems:     "center",
  justifyContent: "center",
  gap:            6,
  padding:        "14px 20px",
  borderRadius:   10,
  border:         "1.5px solid #a7f3d0",
  background:     "#ecfdf5",
  color:          "#065f46",
  fontSize:       12,
  fontWeight:     700,
  cursor:         "pointer",
  transition:     "all 0.15s",
  flexShrink:     0,
  whiteSpace:     "nowrap",
  boxShadow:      "0 1px 4px rgba(16,185,129,0.10)",
};

/** "Preview Structure" outline button (Step 3 header) */
const PREVIEW_BTN = {
  display:      "flex",
  alignItems:   "center",
  gap:          6,
  padding:      "7px 14px",
  borderRadius: 8,
  border:       "1.5px solid #e2e8f0",
  background:   "#fff",
  color:        "#475569",
  fontSize:     13,
  fontWeight:   600,
  cursor:       "pointer",
  transition:   "all 0.15s",
  flexShrink:   0,
};

/** Ã— remove-resident button */
const REMOVE_BTN = {
  background:   "none",
  border:       "none",
  cursor:       "pointer",
  color:        "#94a3b8",
  fontSize:     18,
  padding:      "4px 8px",
  borderRadius: 6,
  transition:   "color 0.15s",
  flexShrink:   0,
};

// â”€â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Single-pixel horizontal rule */
const DIVIDER = {
  height:     1,
  background: "#f1f5f9",
  margin:     "4px 0 16px",
};

/** Full-screen modal backdrop */
const MODAL_OVERLAY = {
  position:       "fixed",
  inset:          0,
  zIndex:         1000,
  background:     "rgba(15,23,42,0.45)",
  backdropFilter: "blur(4px)",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  padding:        24,
};

/** Ã— close button inside a dark modal header */
const MODAL_CLOSE_BTN = {
  background:     "rgba(255,255,255,0.15)",
  border:         "none",
  borderRadius:   8,
  width:          32,
  height:         32,
  cursor:         "pointer",
  color:          "#fff",
  fontSize:       18,
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
};

/** Main white card that wraps each step */
export const MAIN_CARD = {
  root: {
    background:   "#fff",
    borderRadius: 12,
    boxShadow:    "0 2px 12px rgba(0,0,0,0.08)",
    padding:      28,
    border:       "1px solid #f1f5f9",
  },
};

// â”€â”€â”€ Stepper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const STEPPER_CONTAINER = {
  root: {
    background:    "#fff",
    borderRadius:  12,
    padding:       "20px 32px",
    boxShadow:     "0 2px 8px rgba(0,0,0,0.06)",
    marginBottom:  8,
    border:        "1px solid #f1f5f9",
  },
};

/** Horizontal connector line between stepper circles */
const stepperConnector = (active) => ({
  flex:       1,
  height:     3,
  borderRadius: 2,
  margin:     "0 8px",
  background: active ? "#3b82f6" : "#e2e8f0",
  transition: "background 0.4s",
});

/** Stepper circle styles (state: "done" | "active" | "pending") */
export const stepperCircle = (state) => ({
  root: {
    width:       40,
    height:      40,
    borderRadius: "50%",
    flexShrink:  0,
    background:  state === "done" ? "#3b82f6" : state === "active" ? "#fff" : "#f1f5f9",
    border:      state === "active" ? "2.5px solid #3b82f6"
               : state === "done"   ? "none"
               :                      "2.5px solid #e2e8f0",
    boxShadow:   state === "active" ? "0 0 0 4px rgba(59,130,246,0.15)" : "none",
    transition:  "all 0.3s",
  },
});

export const STEPPER_CHECK = { root: { color: "#fff", fontSize: 14, fontWeight: 700 } };

/** Stepper step label (state: "done" | "active" | "pending") */
export const stepperLabel = (state) => ({
  root: {
    fontWeight:  state === "active" ? 700 : 400,
    color:       state === "pending" ? "#94a3b8" : "#1e293b",
    whiteSpace:  "nowrap",
  },
});

// â”€â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SECTION_ICON  = { root: { color: "#3b82f6", fontSize: 16 } };
export const SECTION_TITLE = { root: { fontWeight: 700, color: "#374151" } };

const TOOLTIP_ICON_WRAP = {
  width:          16,
  height:         16,
  borderRadius:   "50%",
  background:     "#dbeafe",
  border:         "1.5px solid #93c5fd",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  cursor:         "default",
  flexShrink:     0,
};

const TOOLTIP_BUBBLE = {
  position:      "absolute",
  bottom:        "calc(100% + 8px)",
  left:          "50%",
  transform:     "translateX(-50%)",
  background:    "#1e293b",
  color:         "#f1f5f9",
  fontSize:      12,
  lineHeight:    1.5,
  borderRadius:  8,
  padding:       "10px 13px",
  width:         230,
  boxShadow:     "0 8px 24px rgba(0,0,0,0.22)",
  zIndex:        999,
  pointerEvents: "none",
  whiteSpace:    "normal",
};

const TOOLTIP_ARROW = {
  position:      "absolute",
  top:           "100%",
  left:          "50%",
  transform:     "translateX(-50%)",
  width:         0,
  height:        0,
  borderLeft:    "6px solid transparent",
  borderRight:   "6px solid transparent",
  borderTop:     "6px solid #1e293b",
};

/** Unit count badge colour depends on whether count > 0 */
const unitCountBadge = (active) => ({
  fontSize:    11,
  color:       active ? "#3b82f6" : "#94a3b8",
  fontWeight:  600,
  whiteSpace:  "nowrap",
  flexShrink:  0,
  minWidth:    48,
  textAlign:   "right",
});

// â”€â”€â”€ Step 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const TOWER_SIDEBAR = {
  root: {
    width:        180,
    flexShrink:   0,
    background:   "#f8fafc",
    borderRadius: 10,
    border:       "1px solid #e2e8f0",
    overflow:     "hidden",
  },
};

export const TOWER_SIDEBAR_HEADER = {
  root: {
    padding:         "12px 14px",
    borderBottom:    "1px solid #e2e8f0",
    background:      "#f1f5f9",
  },
};

/** Tower list-item row (depends on whether it is selected) */
export const towerItem = (selected) => ({
  root: {
    padding:    "10px 14px",
    cursor:     "pointer",
    background: selected ? "#eff6ff" : "transparent",
    borderLeft: selected ? "3px solid #3b82f6" : "3px solid transparent",
    selectors:  { ":hover": { background: selected ? "#eff6ff" : "#f1f5f9" } },
    transition: "all 0.15s",
  },
});

/** Tower name label inside sidebar row */
export const towerItemLabel = (selected) => ({
  root: {
    fontWeight: selected ? 700 : 500,
    color:      selected ? "#1d4ed8" : "#374151",
  },
});

export const TOWER_ICON_BTN = {
  root:        { width: 20, height: 20, color: "#cbd5e1" },
  rootHovered: { color: "#ef4444", background: "transparent" },
};

export const FLOOR_ICON_BTN = {
  root:        { width: 20, height: 20, flexShrink: 0, color: "#cbd5e1" },
  rootHovered: { color: "#ef4444", background: "transparent" },
};

const TOWER_STATS_PILL = {
  display:    "flex",
  alignItems: "center",
  gap:        6,
  background: "#f1f5f9",
  borderRadius: 8,
  padding:    "6px 12px",
};

const FLOOR_HINT = {
  fontSize:   12,
  color:      "#94a3b8",
  marginTop:  10,
};

const FLOOR_LIST = {
  display:       "flex",
  flexDirection: "column",
  gap:           8,
  maxHeight:     380,
  overflowY:     "auto",
  paddingRight:  4,
};

const FLOOR_ROW = {
  display:      "flex",
  alignItems:   "center",
  gap:          12,
  background:   "#f8fafc",
  borderRadius: 8,
  padding:      "10px 14px",
  border:       "1px solid #e2e8f0",
};

export const STEP_FOOTER = {
  root: { marginTop: 20, paddingTop: 16, borderTop: "1px solid #f1f5f9" },
};

// â”€â”€â”€ Step 3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const EMPTY_STATE_WRAPPER = {
  root: {
    background:   "linear-gradient(135deg,#f8fafc,#eff6ff)",
    borderRadius: 12,
    padding:      "40px 24px",
    border:       "2px dashed #bfdbfe",
  },
};

const EMPTY_ICON_WRAP = {
  width:          64,
  height:         64,
  borderRadius:   20,
  background:     "#dbeafe",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
};

const RESIDENT_CARD = {
  display:      "flex",
  alignItems:   "center",
  gap:          12,
  padding:      "12px 14px",
  borderRadius: 10,
  border:       "1px solid #e2e8f0",
  background:   "#fff",
  transition:   "box-shadow 0.15s",
};

/** Dynamic avatar background/text colour from the resident's name initial */
const residentAvatar = (hue) => ({
  width:          36,
  height:         36,
  borderRadius:   10,
  flexShrink:     0,
  background:     `hsl(${hue},65%,88%)`,
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  fontSize:       14,
  fontWeight:     700,
  color:          `hsl(${hue},55%,35%)`,
});

/** Owner (blue) vs Tenant (purple) badge */
const residentTypeBadge = (isOwner) => ({
  fontSize:     11,
  padding:      "1px 8px",
  borderRadius: 12,
  background:   isOwner ? "#eff6ff" : "#f5f3ff",
  color:        isOwner ? "#1d4ed8" : "#6d28d9",
  fontWeight:   600,
});

const RESIDENT_BHK_BADGE = {
  fontSize:     11,
  color:        "#64748b",
  background:   "#f1f5f9",
  padding:      "1px 6px",
  borderRadius: 6,
};

const RESIDENT_EMAIL = {
  overflow:     "hidden",
  textOverflow: "ellipsis",
  whiteSpace:   "nowrap",
  maxWidth:     180,
};

const EXCEL_FORMAT_HINT = {
  root: {
    background:   "#eff6ff",
    borderRadius: 8,
    padding:      "12px 16px",
    border:       "1px solid #bfdbfe",
    minWidth:     0,
  },
};

const EXCEL_CODE_BLOCK = {
  fontSize:    11,
  color:       "#1e40af",
  background:  "#dbeafe",
  padding:     "4px 8px",
  borderRadius: 4,
  display:     "block",
  overflowX:   "auto",
  whiteSpace:  "nowrap",
};

const DOWNLOAD_ICON_WRAP = {
  width:          36,
  height:         36,
  borderRadius:   8,
  background:     "#d1fae5",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  marginBottom:   2,
};

export const DROP_ZONE = {
  root: {
    border:       "2px dashed #bfdbfe",
    borderRadius: 12,
    padding:      "48px 32px",
    background:   "#f8fafc",
    cursor:       "pointer",
    selectors:    { ":hover": { borderColor: "#3b82f6", background: "#eff6ff" } },
    transition:   "all 0.2s",
  },
};

const PREVIEW_TABLE_WRAPPER = {
  overflowX:    "auto",
  borderRadius: 8,
  border:       "1px solid #e2e8f0",
};

// â”€â”€â”€ Success Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SUCCESS_ICON_CIRCLE = {
  root: {
    width:        96,
    height:       96,
    borderRadius: "50%",
    background:   "linear-gradient(135deg,#10b981,#059669)",
    boxShadow:    "0 8px 32px rgba(16,185,129,0.35)",
  },
};

export const BUILDING_ID_BADGE = {
  root: {
    background:   "#1e3a5f",
    borderRadius: 10,
    padding:      "12px 28px",
  },
};

export const STAT_ICON_WRAP = {
  root: { width: 64, height: 64, background: "#eff6ff", borderRadius: 16 },
};

// â”€â”€â”€ Hero header (main component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const HERO_HEADER = {
  background:    "linear-gradient(135deg,#1e3a5f 0%,#1e40af 50%,#2563eb 100%)",
  borderRadius:  16,
  padding:       "28px 32px",
  marginBottom:  20,
  boxShadow:     "0 8px 32px rgba(30,58,95,0.30)",
  position:      "relative",
  overflow:      "hidden",
};

const HERO_BLOB_1 = {
  position:     "absolute",
  top:          -40,
  right:        -40,
  width:        200,
  height:       200,
  borderRadius: "50%",
  background:   "rgba(255,255,255,0.04)",
};

const HERO_BLOB_2 = {
  position:     "absolute",
  bottom:       -60,
  right:        80,
  width:        240,
  height:       240,
  borderRadius: "50%",
  background:   "rgba(255,255,255,0.03)",
};

const HERO_BACK_BTN = {
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  width:          30,
  height:         30,
  borderRadius:   8,
  cursor:         "pointer",
  background:     "rgba(255,255,255,0.10)",
  border:         "1px solid rgba(255,255,255,0.18)",
  transition:     "background 0.15s",
  flexShrink:     0,
};

const HERO_BUILDING_ID_PILL = {
  background:  "rgba(255,255,255,0.12)",
  border:      "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  padding:     "4px 12px",
  fontFamily:  "monospace",
  fontWeight:  800,
  fontSize:    13,
  color:       "#93c5fd",
  letterSpacing: 2,
};

const HERO_TYPE_BADGE = {
  background:   "rgba(255,255,255,0.12)",
  borderRadius: 20,
  padding:      "3px 12px",
  fontSize:     12,
  fontWeight:   700,
  color:        "rgba(255,255,255,0.85)",
  display:      "flex",
  alignItems:   "center",
  gap:          5,
};

const HERO_STEP_BADGE = {
  background:   "rgba(59,130,246,0.25)",
  border:       "1px solid rgba(59,130,246,0.45)",
  borderRadius: 20,
  padding:      "3px 12px",
  fontSize:     12,
  fontWeight:   700,
  color:        "#93c5fd",
  display:      "flex",
  alignItems:   "center",
  gap:          6,
};

const HERO_STEP_DOT = {
  width:        6,
  height:       6,
  borderRadius: "50%",
  background:   "currentColor",
};

const HERO_TITLE = {
  fontSize:      32,
  fontWeight:    900,
  color:         "#fff",
  letterSpacing: -0.5,
  marginBottom:  8,
  lineHeight:    1.1,
};

const HERO_SUBTITLE = {
  fontSize: 14,
  color:    "rgba(255,255,255,0.70)",
};

// â”€â”€â”€ Modal shells (shared by both modals) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MODAL_BODY = {
  padding:   "20px 24px",
  maxHeight: "70vh",
  overflowY: "auto",
};

/** Footer with actions aligned to the right (AddResidentModal) */
const MODAL_FOOTER = {
  padding:        "14px 24px",
  borderTop:      "1px solid #f1f5f9",
  display:        "flex",
  justifyContent: "flex-end",
  gap:            10,
  background:     "#fafafa",
};

/** Footer with a label on the left and actions on the right (StructurePreviewModal) */
const MODAL_FOOTER_SPLIT = {
  padding:        "14px 24px",
  borderTop:      "1px solid #f1f5f9",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "space-between",
  background:     "#fafafa",
};

// â”€â”€â”€ AddResidentModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ADD_MODAL_CONTAINER = {
  background:   "#fff",
  borderRadius: 16,
  width:        "100%",
  maxWidth:     560,
  boxShadow:    "0 25px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12)",
  overflow:     "hidden",
  animation:    "slideUp 0.22s ease",
};

const ADD_MODAL_HEADER = {
  padding:        "20px 24px 16px",
  borderBottom:   "1px solid #f1f5f9",
  background:     "linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "space-between",
};

const ADD_MODAL_ICON_WRAP = {
  width:          36,
  height:         36,
  borderRadius:   10,
  background:     "rgba(255,255,255,0.2)",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
};

/** Tower pill tab â€” selected vs unselected */
const towerTab = (selected) => ({
  padding:      "6px 14px",
  borderRadius: 20,
  border:       "1.5px solid",
  borderColor:  selected ? "#3b82f6" : "#e2e8f0",
  background:   selected ? "#eff6ff" : "#fff",
  color:        selected ? "#1d4ed8" : "#64748b",
  fontSize:     13,
  fontWeight:   selected ? 700 : 400,
  cursor:       "pointer",
  transition:   "all 0.15s",
});

/** Floor tab â€” selected vs unselected */
const floorTab = (selected) => ({
  padding:      "5px 12px",
  borderRadius: 8,
  border:       "1.5px solid",
  borderColor:  selected ? "#8b5cf6" : "#e2e8f0",
  background:   selected ? "#f5f3ff" : "#f8fafc",
  color:        selected ? "#6d28d9" : "#475569",
  fontSize:     12,
  fontWeight:   selected ? 700 : 400,
  cursor:       "pointer",
  transition:   "all 0.15s",
});

/** Unit chip â€” selected (green border), filled (faded), or default */
const unitChip = (selected, filled) => ({
  padding:      "6px 14px",
  borderRadius: 8,
  border:       "1.5px solid",
  borderColor:  selected ? "#10b981" : filled ? "#d1fae5" : "#e2e8f0",
  background:   selected ? "#ecfdf5" : filled ? "#f0fdf4" : "#fff",
  color:        selected ? "#059669" : filled ? "#16a34a" : "#374151",
  fontSize:     13,
  fontWeight:   selected ? 700 : 400,
  cursor:       filled ? "not-allowed" : "pointer",
  opacity:      filled ? 0.65 : 1,
  transition:   "all 0.15s",
  display:      "flex",
  alignItems:   "center",
  gap:          5,
});

/** Resident details block â€” dims and locks when no unit is selected */
const residentDetailsSection = (unitSelected) => ({
  opacity:       unitSelected ? 1 : 0.35,
  pointerEvents: unitSelected ? "auto" : "none",
  transition:    "opacity 0.2s",
});

const UNIT_BADGE = {
  background:   "#ecfdf5",
  color:        "#059669",
  border:       "1px solid #6ee7b7",
  borderRadius: 6,
  padding:      "1px 8px",
  fontSize:     11,
  fontWeight:   700,
};

const ERROR_BOX = {
  marginTop:    14,
  padding:      "10px 14px",
  borderRadius: 8,
  background:   "#fef2f2",
  border:       "1px solid #fecaca",
  color:        "#dc2626",
  fontSize:     13,
  display:      "flex",
  alignItems:   "center",
  gap:          8,
};

/** Submit button â€” active (blue) vs disabled (grey) */
const submitBtn = (enabled) => ({
  padding:      "9px 24px",
  borderRadius: 8,
  border:       "none",
  background:   enabled ? "linear-gradient(135deg,#1e40af,#3b82f6)" : "#e2e8f0",
  color:        enabled ? "#fff" : "#94a3b8",
  fontSize:     13,
  fontWeight:   700,
  cursor:       enabled ? "pointer" : "not-allowed",
  transition:   "all 0.2s",
});

// â”€â”€â”€ StructurePreviewModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PREVIEW_MODAL_CONTAINER = {
  background:    "#fff",
  borderRadius:  18,
  width:         "100%",
  maxWidth:      680,
  maxHeight:     "85vh",
  display:       "flex",
  flexDirection: "column",
  boxShadow:     "0 32px 64px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.12)",
  overflow:      "hidden",
  animation:     "slideUp 0.22s ease",
};

const PREVIEW_MODAL_HEADER = {
  padding:        "20px 24px",
  borderBottom:   "1px solid #f1f5f9",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "space-between",
  background:     "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",
};

const PREVIEW_MODAL_ICON_WRAP = {
  width:          40,
  height:         40,
  borderRadius:   12,
  background:     "rgba(255,255,255,0.1)",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
};

const STATS_BAR = {
  display:      "flex",
  gap:          0,
  borderBottom: "1px solid #f1f5f9",
  background:   "#f8fafc",
};

/** Stat cell â€” all but the last have a right border */
const statCell = (isLast) => ({
  flex:        1,
  padding:     "14px 16px",
  borderRight: isLast ? "none" : "1px solid #e2e8f0",
  textAlign:   "center",
});

const PROGRESS_SECTION = {
  padding:      "10px 24px 0",
  background:   "#f8fafc",
  borderBottom: "1px solid #f1f5f9",
};

const PROGRESS_TRACK = {
  height:       6,
  background:   "#e2e8f0",
  borderRadius: 3,
  marginBottom: 10,
  overflow:     "hidden",
};

/** Progress fill bar â€” pct is a number 0-100 */
const progressFill = (pct) => ({
  height:     "100%",
  borderRadius: 3,
  width:      `${pct}%`,
  background: "linear-gradient(90deg,#10b981,#34d399)",
  transition: "width 0.5s ease",
});

const TOWER_LIST = {
  flex:      1,
  overflowY: "auto",
  padding:   "16px 24px",
};

const TOWER_CARD = {
  marginBottom: 12,
  borderRadius: 12,
  border:       "1px solid #e2e8f0",
  overflow:     "hidden",
};

/** Tower header button â€” background tint comes from TOWER_COLORS */
const towerHeaderBtn = (bg) => ({
  width:          "100%",
  padding:        "12px 16px",
  background:     bg,
  border:         "none",
  cursor:         "pointer",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "space-between",
});

/** Coloured tower-letter avatar */
const towerAvatar = (color) => ({
  width:          32,
  height:         32,
  borderRadius:   8,
  background:     color,
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  color:          "#fff",
  fontSize:       14,
  fontWeight:     800,
});

const TOWER_MINI_TRACK = {
  height:       4,
  width:        60,
  background:   "#e2e8f0",
  borderRadius: 2,
  marginTop:    2,
};

/** Mini progress fill inside tower header */
const towerMiniFill = (pct, color) => ({
  height:       "100%",
  borderRadius: 2,
  background:   color,
  width:        `${pct}%`,
});

const FLOORS_BODY = {
  background: "#fff",
  padding:    "10px 16px 14px",
};

const FLOOR_LABEL_CHIP = {
  fontSize:      11,
  fontWeight:    700,
  color:         "#64748b",
  background:    "#f1f5f9",
  borderRadius:  4,
  padding:       "2px 8px",
  letterSpacing: "0.04em",
};

const FLOOR_DIVIDER = {
  flex:       1,
  height:     1,
  background: "#f1f5f9",
};

/** Unit chip in StructurePreviewModal â€” filled (assigned) vs empty */
const previewUnitChip = (filled) => ({
  display:      "inline-flex",
  alignItems:   "center",
  gap:          5,
  padding:      "4px 10px",
  borderRadius: 20,
  border:       `1.5px solid ${filled ? "#6ee7b7" : "#e2e8f0"}`,
  background:    filled ? "#ecfdf5" : "#f8fafc",
  fontSize:      12,
  color:         filled ? "#065f46" : "#64748b",
  fontWeight:    filled ? 600 : 400,
  cursor:        filled ? "default" : "pointer",
  transition:    "all 0.15s",
});

// â”€â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Column header cell for the XLSX preview table */
const COL_HEADER = {
  fontSize:     12,
  color:        "#64748b",
  textAlign:    "left",
  padding:      "6px 8px",
  fontWeight:   600,
  borderBottom: "1px solid #e2e8f0",
};

// â”€â”€â”€ Text utility styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Muted/placeholder text â€” #94a3b8 */
export const MUTED_TEXT     = { root: { color: "#94a3b8" } };
/** Secondary descriptive text â€” #64748b */
export const SECONDARY_TEXT = { root: { color: "#64748b" } };
/** Primary bold text â€” 700 / #1e293b */
export const BOLD_DARK      = { root: { fontWeight: 700, color: "#1e293b" } };
/** Semi-bold primary text â€” 600 / #1e293b */
const SEMIBOLD_DARK  = { root: { fontWeight: 600, color: "#1e293b" } };

// â”€â”€â”€ Icon utility styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const ICON_BLUE        = { root: { color: "#3b82f6" } };
const ICON_BLUE_14     = { root: { color: "#3b82f6", fontSize: 14 } };
export const ICON_BLUE_20     = { root: { color: "#3b82f6", fontSize: 20 } };
export const ICON_BLUE_30     = { root: { fontSize: 30, color: "#3b82f6" } };
export const ICON_GREY_13     = { root: { fontSize: 13, color: "#64748b" } };
export const ICON_PURPLE_16   = { root: { color: "#8b5cf6", fontSize: 16 } };
export const ICON_GREEN_16    = { root: { color: "#10b981", fontSize: 16 } };
export const ICON_GREEN_18    = { root: { fontSize: 18, color: "#059669" } };
export const ICON_WHITE_13    = { root: { color: "#fff", fontSize: 13 } };
export const ICON_13          = { root: { fontSize: 13 } };
export const ICON_14          = { root: { fontSize: 14 } };
export const ICON_12          = { root: { fontSize: 12 } };
export const ICON_BACK        = { root: { fontSize: 13, color: "rgba(255,255,255,0.85)" } };
export const ICON_UPLOAD_36   = { root: { fontSize: 36, color: "#93c5fd" } };
export const ICON_SUCCESS_24  = { root: { fontSize: 24, color: "#3b82f6" } };
export const ICON_SUCCESS_44  = { root: { fontSize: 44, color: "#fff" } };

// â”€â”€â”€ Shared layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Generic flex-1 root wrapper (e.g. Pivot) */
export const FLEX_1             = { root: { flex: 1 } };
/** NumberField wrapper Stack */
export const NUMBER_FIELD_STACK = { root: { flex: 1, minWidth: 140 } };
/** Step section body padding */
export const SECTION_BODY       = { root: { padding: "16px 0" } };
/** Inline MessageBar top margin */
export const MSG_BAR_TOP        = { root: { marginTop: 8 } };
/** Spinner placed inline after a button label */
export const SPINNER_INLINE     = { root: { marginLeft: 8 } };
/** Step 1 footer (Next button row) */
export const STEP1_FOOTER       = { root: { marginTop: 24 } };
/** Step 2 main panel min-height */
export const STEP2_MAIN         = { root: { minHeight: 480 } };
/** Full-page loading wrapper */
export const LOADING_WRAP       = { root: { paddingTop: 80 } };

// â”€â”€â”€ Step 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Society name TextField (wider flex) */
export const SOCIETY_NAME_INPUT    = { ...INPUT_STYLES, root: { flex: 2 } };
/** Society type Dropdown */
export const SOCIETY_TYPE_DROPDOWN = { root: { flex: 1 }, dropdown: { borderRadius: 6 } };
/** Multiline address TextField */
export const TEXTAREA_STYLES       = { fieldGroup: { borderRadius: 6, border: "1px solid #e2e8f0" } };

// â”€â”€â”€ Step 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** "TOWERS" uppercase label inside the sidebar */
export const TOWER_SIDEBAR_LABEL = { root: { fontWeight: 700, color: "#475569" } };
/** Add Tower button container (footer of sidebar) */
export const ADD_TOWER_FOOTER    = { root: { padding: "8px 10px", borderTop: "1px solid #e2e8f0" } };
/** "Add Tower" DefaultButton */
export const ADD_TOWER_BTN       = { root: { borderRadius: 6, height: 30, border: "none" }, label: { fontSize: 12 } };
/** "Add Floor" DefaultButton */
export const ADD_FLOOR_BTN       = { root: { borderRadius: 6, height: 32, border: "1px solid #e2e8f0" }, label: { fontSize: 12 } };
/** Step Back DefaultButton (shared by Step 2 and Step 3) */
export const BACK_BTN            = { root: { borderRadius: 8, height: 40 } };

// â”€â”€â”€ Step 3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Excel format-hint box title */
const EXCEL_HINT_TITLE   = { root: { fontWeight: 600, color: "#1d4ed8" } };
/** Excel format-hint info line */
const EXCEL_HINT_INFO    = { root: { color: "#3b82f6" } };
/** Drop zone primary prompt */
export const DROP_ZONE_TITLE    = { root: { fontWeight: 600, color: "#1e293b" } };
/** "Change file" DefaultButton */
export const CHANGE_FILE_BTN    = { root: { borderRadius: 6, fontSize: 12 }, label: { fontSize: 12 } };
/** "Confirm Import" PrimaryButton */
export const CONFIRM_IMPORT_BTN = { root: { borderRadius: 8, width: "fit-content" }, label: { fontWeight: 700 } };
/** "X residents parsed" count text */
export const PARSED_COUNT       = { root: { fontWeight: 600 } };

// â”€â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Outer wrapper padding for the success screen */
export const SUCCESS_OUTER     = { root: { paddingTop: 32, paddingBottom: 32 } };
/** "BUILDING ID" caption label */
export const BUILDING_ID_LABEL = { root: { color: "#93c5fd", letterSpacing: 2, fontWeight: 600 } };
/** Building ID monospace value */
export const BUILDING_ID_VALUE = { root: { fontSize: 20, color: "#fff", fontWeight: 800, letterSpacing: 3, fontFamily: "monospace" } };
/** Stat number (units / residents / towers) */
export const STAT_VALUE        = { root: { fontSize: 22, fontWeight: 700, color: "#1e293b" } };
/** "Back to Onboarding" DefaultButton */
const BACK_TO_LIST_BTN  = { root: { borderRadius: 8, height: 40, padding: "0 20px" } };
