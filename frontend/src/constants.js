// ─── Ticket statuses ──────────────────────────────────────────────────────────
export const ticketStatuses = [
  { key: "OPEN",        label: "Open"        },
  { key: "ASSIGNED",    label: "Assigned"    },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED",    label: "Resolved"    },
  { key: "CLOSED",      label: "Closed"      },
];

// ─── Society types ────────────────────────────────────────────────────────────
// Display labels for society types (domain data, not styling).
// Colours / badges live in cssConstants.js → SOCIETY_TYPE_COLORS.
export const SOCIETY_TYPE_LABELS = {
  APARTMENT:       "Apartment",
  GATED_COMMUNITY: "Gated Community",
  COMMERCIAL:      "Commercial",
  MIXED_USE:       "Mixed Use",
};

// ─── Navigation ───────────────────────────────────────────────────────────────
export const navLinks = [
  { name: "Incident Dashboard", key: "dashboard",   path: "/",            iconProps: { iconName: "Home"        } },
  { name: "Onboarding",         key: "onboarding",  path: "/onboarding",  iconProps: { iconName: "Add"         } },
  { name: "Users",              key: "users",        path: "/users",       iconProps: { iconName: "Contact"     } },
  { name: "Complaints",         key: "complaints",   path: "/complaints",  iconProps: { iconName: "MessageFill" } },
  { name: "Vendors",            key: "vendors",      path: "/vendors",     iconProps: { iconName: "Shop"        } },
  { name: "Payments",           key: "payments",     path: "/payments",    iconProps: { iconName: "PaymentCard" } },
  { name: "Maintenance",        key: "maintenance",  path: "/maintenance", iconProps: { iconName: "Money"       } },
];

// ─── Vendor categories ────────────────────────────────────────────────────────
// Single source of truth for all valid vendor category strings.
// Keys are SCREAMING_SNAKE identifiers; values are the canonical display strings
// that are also stored verbatim in the DB (vendors.categories TEXT[]).
// The backend mirrors this list in backend/src/constants.js for API validation.
// Never hard-code these strings anywhere else — always reference this object.
const VENDOR_CATEGORIES = Object.freeze({
  ELECTRICIANS:          "Electricians",
  PLUMBERS:              "Plumbers",
  HOUSEKEEPING:          "Housekeeping",
  PEST_CONTROL:          "Pest Control",
  CARPENTERS:            "Carpenters",
  CCTV_TECHNICIANS:      "CCTV Technicians",
  APPLIANCE_REPAIR:      "Appliance Repair",
  LIFT_MAINTENANCE:      "Lift Maintenance",
  SECURITY_AGENCIES:     "Security Agencies",
  PAINTING_CONTRACTORS:  "Painting Contractors",
  WATER_TANK_CLEANING:   "Water Tank Cleaning",
  AC_SERVICING:          "AC Servicing",
  GENERATOR_MAINTENANCE: "Generator Maintenance",
});

// Dropdown options derived from the enum — key and text are both the display string
// so that what the user selects is exactly what gets stored in the DB.
export const VENDOR_CATEGORY_OPTIONS = Object.values(VENDOR_CATEGORIES).map(
  (label) => ({ key: label, text: label }),
);

// ─── Vendor status filter options ─────────────────────────────────────────────
// Used in the Vendors page filter dropdown.
export const VENDOR_STATUS_FILTER_OPTIONS = [
  { key: "ALL",                  text: "All Vendors"           },
  { key: "VERIFICATION_PENDING", text: "Pending Verification"  },
  { key: "APPROVED",             text: "Approved"              },
  { key: "REJECTED",             text: "Rejected"              },
  { key: "SUSPENDED",            text: "Suspended"             },
];

// ─── Resident contact options ─────────────────────────────────────────────────
// String keys used in selects / lookups (SocietyDetail, AddResidentForm).
// Rich objects (with labels and emojis) live in onboardingUtils.js → CONTACT_OPTIONS.
export const CONTACT_OPTION_KEYS = ["WHATSAPP", "CALL", "SMS", "EMAIL"];

// ─── BHK / house-size options ─────────────────────────────────────────────────
// Also exported from onboardingUtils.js; imported from here wherever no XLSX
// functionality is needed to avoid pulling in the xlsx dependency.
export const BHK_OPTIONS = [
  "Studio", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK+", "Villa", "Duplex",
];

// ─── Maintenance expense sheet defaults ───────────────────────────────────────
// Pre-filled rows shown when a secretary opens the expense sheet for the first
// time. Saved sheets from the API override these.
export const DEFAULT_FIXED_EXPENSE_ITEMS = [
  { particulars: "Sinking Fund",            total_amount: "" },
  { particulars: "Structural Repair Fee",   total_amount: "" },
  { particulars: "Insurance",               total_amount: "" },
  { particulars: "Parking Fee",             total_amount: "" },
  { particulars: "Security Fee",            total_amount: "" },
  { particulars: "Housekeeping Fee",        total_amount: "" },
  { particulars: "Society Management Fee",  total_amount: "" },
  { particulars: "Lift Maintenance AMC",    total_amount: "" },
];

export const DEFAULT_VARIABLE_EXPENSE_ITEMS = [
  { particulars: "Garbage Collection Fee",  total_amount: "" },
  { particulars: "Electricity Bill",        total_amount: "" },
  { particulars: "Generator Fuel",          total_amount: "" },
  { particulars: "Water Tank Cleaning Fee", total_amount: "" },
  { particulars: "Non-Occupancy Charges",   total_amount: "" },
];

// ─── Announcement options ──────────────────────────────────────────────────────
export const ANNOUNCEMENT_CATEGORY_OPTIONS = [
  { key: "GENERAL",     text: "General"     },
  { key: "MAINTENANCE", text: "Maintenance" },
  { key: "NOTICE",      text: "Notice"      },
  { key: "EVENT",       text: "Event"       },
  { key: "EMERGENCY",   text: "Emergency"   },
];

export const ANNOUNCEMENT_PRIORITY_OPTIONS = [
  { key: "NORMAL", text: "Normal" },
  { key: "URGENT", text: "Urgent" },
];

// ─── Resident form options ─────────────────────────────────────────────────────
export const RESIDENT_TYPE_OPTIONS = [
  { key: "OWNER",  text: "Owner"  },
  { key: "TENANT", text: "Tenant" },
];

export const BILL_RECIPIENT_OPTIONS = [
  { key: "OWNER",  text: "Owner (default)" },
  { key: "TENANT", text: "Tenant"          },
];

export const CONTACT_PREFERENCE_OPTIONS = [
  { key: "WHATSAPP", text: "WhatsApp" },
  { key: "CALL",     text: "Call"     },
  { key: "SMS",      text: "SMS"      },
  { key: "EMAIL",    text: "Email"    },
];

// ─── Maintenance due day options (1–28, avoids month-end issues) ──────────────
function _ordinalSuffix(n) {
  if (n >= 11 && n <= 13) return "th";
  const mod = n % 10;
  return mod === 1 ? "st" : mod === 2 ? "nd" : mod === 3 ? "rd" : "th";
}

export const MAINTENANCE_DUE_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const n = i + 1;
  return { key: n, text: `${n}${_ordinalSuffix(n)} of every month` };
});

// ─── Ticket status filter options (includes "ALL" sentinel for dropdowns) ──────
export const TICKET_STATUS_FILTER_OPTIONS = [
  { key: "ALL", text: "All Statuses" },
  ...ticketStatuses.map(({ key, label }) => ({ key, text: label })),
];
