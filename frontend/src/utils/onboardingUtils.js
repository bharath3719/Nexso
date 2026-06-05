/**
 * onboardingUtils.js
 * ──────────────────
 * Domain constants and pure utility functions for the OnboardingNew flow.
 * No JSX, no side-effects — safe to import anywhere.
 */

import * as XLSX from "xlsx";

// ─── Domain constants ─────────────────────────────────────────────────────────

export const BUILDING_FORM_DEFAULTS = {
  name: "", address: "", society_type: "APARTMENT",
  num_towers: 2, num_floors: 5, num_units: 4,
  contact_person: "", contact_phone: "", contact_email: "",
};

export const XLSX_TABLE_KEYS = [
  "tower", "floor", "unit_number", "resident_name", "phone", "email",
  "type", "aadhar_number", "bhk", "preferred_contact", "family_members",
  "maintenance_enabled", "maintenance_amount", "maintenance_due_day",
];
export const XLSX_TABLE_HEADERS = [
  "Tower", "Floor", "Unit #", "Name", "Phone", "Email",
  "Type", "Aadhar", "BHK", "Contact", "Family",
  "Maint. Enabled", "Amount (₹)", "Due Day",
];

export const SOCIETY_TYPES = [
  { key: "APARTMENT",       text: "🏢  Apartment"       },
  { key: "GATED_COMMUNITY", text: "🏡  Gated Community"  },
  { key: "COMMERCIAL",      text: "🏬  Commercial"       },
  { key: "MIXED_USE",       text: "🏙️  Mixed Use"        },
];

export const STEPS = [
  { label: "Building Details", icon: "CityNext" },
  { label: "Unit Structure",   icon: "GridViewSmall" },
  { label: "Residents",        icon: "People"   },
];

export const BHK_OPTIONS = [
  "Studio", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK+", "Villa", "Duplex",
];

export const CONTACT_OPTIONS = [
  { value: "WHATSAPP", label: "WhatsApp", emoji: "💬" },
  { value: "CALL",     label: "Call",     emoji: "📞" },
  { value: "SMS",      label: "SMS",      emoji: "✉️" },
  { value: "EMAIL",    label: "Email",    emoji: "📧" },
];

// ─── Floor / tower builders ───────────────────────────────────────────────────

/** Generate standard unit numbers: floor 1 → 101,102 | floor 10 → 1001,1002 */
export function buildDefaultFloors(numFloors, unitsPerFloor = 4) {
  return Array.from({ length: numFloors }, (_, fi) => {
    const floorNum = fi + 1;
    return {
      floor_number: floorNum,
      units: Array.from(
        { length: unitsPerFloor },
        (_, ui) => `${floorNum}${String(ui + 1).padStart(2, "0")}`,
      ),
    };
  });
}

export function initTowers(numTowers, numFloors, numUnits) {
  return Array.from({ length: numTowers }, (_, i) => ({
    name:   `Tower ${String.fromCharCode(65 + i)}`,
    floors: buildDefaultFloors(numFloors, numUnits),
  }));
}

/** Total unit count across all towers */
export function countTotalUnits(towers) {
  return towers.reduce(
    (sum, t) => sum + t.floors.reduce((fs, f) => fs + f.units.length, 0),
    0,
  );
}

// ─── XLSX helpers ─────────────────────────────────────────────────────────────

/**
 * Parse an uploaded XLSX file (ArrayBuffer) → array of row-objects keyed by
 * lower-snake-cased header names (e.g. "Resident Name" → "resident_name").
 *
 * Supports multi-sheet workbooks (one sheet per tower): the sheet name is
 * injected as the "tower" field on every row from that sheet.
 * Single-sheet workbooks (old format) are parsed as-is.
 */
export function parseXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const allRows = [];

  wb.SheetNames.forEach((sheetName) => {
    // Skip the "Reference" info sheet that is appended to the template
    if (sheetName === "Reference") return;

    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    rows.forEach((row) => {
      const normalised = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.trim().toLowerCase().replace(/\s+/g, "_"),
          String(v ?? "").trim(),
        ]),
      );
      // In multi-sheet format the sheet name IS the tower;
      // in single-sheet format keep whatever "tower" column the row has.
      if (wb.SheetNames.length > 1 || !normalised.tower) {
        normalised.tower = sheetName;
      }
      allRows.push(normalised);
    });
  });

  return allRows;
}

/**
 * Build a downloadable XLSX template pre-filled with every unit in the structure.
 *
 * Format:
 *   • One data sheet per tower, named after the tower.
 *   • Each row has resident fields + three maintenance columns:
 *       maintenance_enabled  → pre-filled "NO"  (change to "YES" to enable)
 *       maintenance_amount   → blank             (monthly ₹ amount)
 *       maintenance_due_day  → blank             (day 1-28 of every month)
 *   • A final "Reference" sheet lists all valid values for enumerated columns.
 *
 * NOTE: SheetJS CE (xlsx 0.18.x) does not support writing native Excel dropdown
 * validations; the Reference sheet serves as the in-file guide for valid values.
 */
export function generateTemplateXlsx(towers) {
  const SHEET_HEADERS = [
    "floor", "unit_number", "resident_name", "phone", "email",
    "type",  "aadhar_number", "bhk", "preferred_contact", "family_members",
    // ── Maintenance (new) ──
    "maintenance_enabled", "maintenance_amount", "maintenance_due_day",
  ];
  // column widths (chars)
  const COL_WIDTHS = [8, 14, 22, 16, 28, 10, 18, 10, 20, 14, 20, 18, 14];

  // Indices of maintenance columns (used for styling)
  const MAINT_COLS = new Set([10, 11, 12]);

  const wb = XLSX.utils.book_new();

  // ── Data sheets (one per tower) ───────────────────────────────────────────

  towers.forEach((tower) => {
    const dataRows = [];
    tower.floors.forEach((floor) =>
      floor.units.forEach((unit) =>
        dataRows.push({
          floor:                floor.floor_number,
          unit_number:          unit,
          resident_name:        "",
          phone:                "",
          email:                "",
          type:                 "OWNER",
          aadhar_number:        "",
          bhk:                  "",
          preferred_contact:    "WHATSAPP",
          family_members:       0,
          // Maintenance defaults — admin changes YES/NO and fills amount + due day
          maintenance_enabled:  "NO",
          maintenance_amount:   "",
          maintenance_due_day:  "",
        }),
      ),
    );

    const ws = XLSX.utils.json_to_sheet(dataRows, { header: SHEET_HEADERS });
    ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));

    // Style header row: bold everywhere, light-green fill on maintenance columns
    SHEET_HEADERS.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (!ws[addr]) return;
      ws[addr].s = MAINT_COLS.has(ci)
        ? { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "C8E6C9" } } }
        : { font: { bold: true } };
    });

    const safeSheetName = tower.name.replace(/[:\\/?*[\]]/g, "").slice(0, 31) || "Tower";
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  });

  // ── Reference sheet ───────────────────────────────────────────────────────
  // Lists valid values for all enumerated columns so admins don't have to guess.

  const refRows = [
    { column: "type",                valid_values: "OWNER  |  TENANT",                      notes: "Resident status in the unit" },
    { column: "preferred_contact",   valid_values: "WHATSAPP  |  CALL  |  SMS  |  EMAIL",   notes: "How to send WhatsApp/SMS notifications" },
    { column: "bhk",                 valid_values: "Studio | 1 BHK | 2 BHK | 3 BHK | 4 BHK | 5 BHK+ | Villa | Duplex", notes: "Unit size (free text OK)" },
    { column: "maintenance_enabled", valid_values: "YES  |  NO",                            notes: "Set YES to auto-generate dues & send payment reminders" },
    { column: "maintenance_amount",  valid_values: "Any whole number  (e.g. 2500)",         notes: "Monthly amount in ₹; required when maintenance_enabled = YES" },
    { column: "maintenance_due_day", valid_values: "1 – 28  (e.g. 5 means the 5th of every month)", notes: "Day of month the payment is due; required when maintenance_enabled = YES" },
  ];

  const refWs = XLSX.utils.json_to_sheet(refRows, {
    header: ["column", "valid_values", "notes"],
  });
  refWs["!cols"] = [{ wch: 24 }, { wch: 52 }, { wch: 54 }];
  // Bold the header row of the reference sheet
  ["A1", "B1", "C1"].forEach((addr) => {
    if (refWs[addr]) refWs[addr].s = { font: { bold: true } };
  });

  XLSX.utils.book_append_sheet(wb, refWs, "Reference");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
