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

/** Broadcast audiences — mirrors the secretary broadcast page on the web. */
export const BROADCAST_TARGETS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'TOWER', label: 'One tower' },
] as const;
