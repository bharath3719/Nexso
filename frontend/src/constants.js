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
