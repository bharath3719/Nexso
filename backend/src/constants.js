/**
 * backend/src/constants.js
 *
 * Canonical domain constants shared across routes and services.
 * Keep in sync with frontend/src/constants.js — the two lists must be identical.
 */

// ─── Vendor categories ────────────────────────────────────────────────────────
// These are the only strings allowed in vendors.categories[].
// Used for input validation on POST /api/vendors and PUT /api/vendors/:id.
export const VENDOR_CATEGORIES = Object.freeze([
  "Electricians",
  "Plumbers",
  "Housekeeping",
  "Pest Control",
  "Carpenters",
  "CCTV Technicians",
  "Appliance Repair",
  "Lift Maintenance",
  "Security Agencies",
  "Painting Contractors",
  "Water Tank Cleaning",
  "AC Servicing",
  "Generator Maintenance",
]);
