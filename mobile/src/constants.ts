/**
 * constants.ts — domain constants shared across screens.
 *
 * These mirror the web portal's values, mostly from frontend/src/constants.js
 * and the per-page literals. Where a value is also enforced by the backend
 * (ticket statuses, RSVP responses, poll option indices) the comment says so —
 * changing it here alone will produce a 400.
 */

/**
 * Complaint categories offered to residents.
 * Mirrors CATEGORIES in frontend/src/pages/resident/ResidentComplaints.jsx.
 * Free text as far as the API is concerned — tickets.category has no CHECK
 * constraint — but keep the two lists identical so reporting stays consistent.
 */
export const COMPLAINT_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Lift / Elevator',
  'Housekeeping',
  'Security',
  'Carpentry',
  'Common Area',
  'Other',
] as const;

/** Icon per category, for the complaint list rows. */
export const CATEGORY_ICON: Record<string, string> = {
  Plumbing: 'water-outline',
  Electrical: 'flash-outline',
  'Lift / Elevator': 'swap-vertical-outline',
  Housekeeping: 'sparkles-outline',
  Security: 'shield-checkmark-outline',
  Carpentry: 'hammer-outline',
  'Common Area': 'business-outline',
  Other: 'ellipsis-horizontal-circle-outline',
};

/** tickets.priority — the backend coerces anything but 'URGENT' to 'NORMAL'. */
export const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

/** event_rsvps.response — validated against exactly this list server-side. */
export const RSVP_OPTIONS = [
  { value: 'YES', label: 'Going', icon: 'checkmark-circle' },
  { value: 'MAYBE', label: 'Maybe', icon: 'help-circle' },
  { value: 'NO', label: "Can't go", icon: 'close-circle' },
] as const;

/** Filters on the resident billing screen — map to ?type= on the dues endpoint. */
export const DUES_FILTERS = [
  { value: 'pending', label: 'Outstanding' },
  { value: 'history', label: 'Paid' },
] as const;

/** Filters on the secretary tickets screen — map to ?status=. */
export const TICKET_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

/** Filters on the secretary maintenance screen — map to ?status=. */
export const DUE_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PENDING_VERIFICATION', label: 'To Verify' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
] as const;

/**
 * Broadcast audiences. The backend branches on exactly these three values in
 * routes/secretary.js — anything else silently falls through to ALL.
 */
export const BROADCAST_TARGETS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'TOWER', label: 'One tower' },
  { value: 'OVERDUE', label: 'Overdue only' },
] as const;

// ─── Society ledger ───────────────────────────────────────────────────────────
//
// Copied from frontend/src/pages/secretary/SecretaryExpenses.jsx, which is the
// canonical list. society_expenses.category has no CHECK constraint — the API
// stores whatever it is sent — so a value that drifts from the web list will
// save happily and then sit in its own bucket on every report. Keep them equal.
//
// The terminology follows Indian cooperative society accounting: Income &
// Expenditure rather than P&L, surplus/deficit rather than profit/loss.

export type Option = { value: string; label: string };

export const EXPENSE_CATEGORIES: ReadonlyArray<{ value: string; label: string; sub: readonly string[] }> = [
  {
    value: 'SALARY_WAGES',
    label: 'Salary & Wages',
    sub: ['Security Guard', 'Sweeping / Housekeeping', 'Gardener', 'Lift Operator', 'Society Manager', 'Accountant / Clerk'],
  },
  {
    value: 'UTILITIES',
    label: 'Utilities',
    sub: ['Common Area Electricity', 'Water (Municipal Supply)', 'Generator Fuel', 'Generator Maintenance', 'Internet / CCTV Bandwidth'],
  },
  {
    value: 'REPAIRS_MAINTENANCE',
    label: 'Repairs & Maintenance',
    sub: ['Lift (Ad-hoc Repair)', 'Plumbing', 'Electrical (Common Area)', 'Civil / Masonry', 'Painting / Waterproofing', 'Gate / Boom Barrier', 'Pump Maintenance', 'Terrace / Roof'],
  },
  {
    value: 'AMC_CONTRACTS',
    label: 'AMC / Contracts',
    sub: ['Lift AMC', 'Fire Fighting System AMC', 'CCTV / Intercom AMC', 'Generator AMC', 'Pest Control Contract', 'Housekeeping Contract'],
  },
  {
    value: 'ADMINISTRATIVE',
    label: 'Administrative',
    sub: ['Printing & Stationery', 'Bank Charges', 'Postage / Courier', 'Software / Subscription', 'Office Expenses'],
  },
  {
    value: 'STATUTORY_LEGAL',
    label: 'Statutory & Legal',
    sub: ['Property Tax', 'Audit Fees', 'Legal / Consultant Fees', 'Registration / Filing', 'GST / Other Taxes'],
  },
  {
    value: 'INSURANCE',
    label: 'Insurance',
    sub: ['Building Insurance', 'Lift Insurance', 'Public Liability'],
  },
  {
    value: 'FESTIVAL_EVENTS',
    label: 'Festival & Events',
    sub: ['Festival Celebration', 'Decoration', 'Community Event'],
  },
  {
    value: 'CAPITAL_WORKS',
    label: 'Capital Works',
    sub: ['Lift Replacement / Modernisation', 'Solar Installation', 'STP / WTP Work', 'Major Civil Work', 'Equipment Purchase'],
  },
  { value: 'OTHERS', label: 'Others / Miscellaneous', sub: [] },
];

export const INCOME_CATEGORIES: ReadonlyArray<Option> = [
  { value: 'PARKING_CHARGES', label: 'Parking Charges' },
  { value: 'HALL_BOOKING', label: 'Hall / Amenity Booking' },
  { value: 'NOC_TRANSFER_FEES', label: 'NOC / Transfer Fees' },
  { value: 'PENALTY_INTEREST', label: 'Penalty / Late Fees from Residents' },
  { value: 'FD_INTEREST', label: 'Bank FD / Savings Interest' },
  { value: 'ADVERTISEMENT', label: 'Advertisement / Tower / Hoarding Rental' },
  { value: 'DONATIONS', label: 'Donations / Contributions' },
  { value: 'OTHERS', label: 'Others / Miscellaneous' },
];

/** society_expenses.payment_mode / society_other_income.payment_mode. */
export const PAYMENT_MODES: ReadonlyArray<Option> = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer / NEFT / RTGS' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
];

/** Which society fund the money left. */
export const FUND_SOURCES: ReadonlyArray<Option> = [
  { value: 'MAINTENANCE_FUND', label: 'Maintenance Fund (Day-to-day)' },
  { value: 'SINKING_FUND', label: 'Sinking Fund (Major repairs)' },
  { value: 'CORPUS_FUND', label: 'Corpus Fund (Reserve)' },
  { value: 'OTHER', label: 'Other' },
];

/** Short labels — the full ones above are too long for a chip. */
export const EXPENSE_TYPES = [
  { value: 'OPEX', label: 'OpEx' },
  { value: 'CAPEX', label: 'CapEx' },
] as const;

export const FUND_SOURCES_SHORT: ReadonlyArray<Option> = [
  { value: 'MAINTENANCE_FUND', label: 'Maintenance' },
  { value: 'SINKING_FUND', label: 'Sinking' },
  { value: 'CORPUS_FUND', label: 'Corpus' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Enum key → display label, falling back to the key with underscores stripped.
 * A row saved by an older build (or by the web with a category since renamed)
 * still reads sensibly instead of rendering blank.
 */
export function labelFor(options: ReadonlyArray<Option>, value?: string | null): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}

export function expenseCategoryLabel(value?: string | null): string {
  if (!value) return '—';
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value.replace(/_/g, ' ');
}
