# Nexso — Product Backlog

**Legend**
- ✅ Done — fully built and live
- 🟡 Partial — backend/DB exists, UI incomplete or gaps remain
- 🟠 Medium — new tables + API + UI needed, 1–3 day effort
- ⬜ Phase 2 — defer until MVP is stable

---

## Epic RES-01: Resident Identity and Access

### RES-101 — WhatsApp OTP login `✅ Done`
Residents log in with their registered WhatsApp number. OTP issued, TTL enforced, JWT minted with RESIDENT role scoped to society + unit.

### RES-102 — Resident-unit mapping and access control `✅ Done`
Auth middleware scopes every resident API call to the correct society_id + unit_id. RESIDENT portal_role in auth_accounts.

### RES-103 — First-time profile setup `✅ Done`
`force_profile_setup` gate in App.jsx blocks all routes until the resident fills in household details. Profile editable any time from My Profile.

---

## Epic RES-02: Resident Dashboard and Communication

### RES-201 — Resident home dashboard `✅ Done`
Stat cards: open complaints, pending/overdue dues, active visitor passes, announcements, open complaints. Quick-action buttons to each module. Urgent announcement banner.

### RES-202 — Secretary announcements feed `✅ Done`
Secretary creates/pins/categorises announcements. Resident sees them in reverse-chrono order, pinned and urgent first.

### RES-203 — Notification center and preferences `⬜ Phase 2`
In-app notification store, unread count badge, per-resident preference toggles. Significant infrastructure not yet built.

---

## Epic RES-03: Visitor Management

### RES-301 — Create visitor pass `✅ Done`
Resident creates a pass with visitor name, phone, purpose, vehicle, validity window. Unique pass_code generated.

### RES-302 — Generate and share visitor card `✅ Done`
Share pass URL via WhatsApp, Gmail, Email app, or native share. Copy link. Pass code shown as monospace chip.

### RES-303 — Security gate verification `✅ Done`
Guard portal logs in with username/password. Looks up pass by code or phone. One-tap "Mark Used". Entry logged.

### RES-304 — Visitor history and revoke pass `✅ Done`
Resident sees all passes with status filters (ACTIVE / USED / EXPIRED / REVOKED). Can revoke any active pass.

---

## Epic RES-04: Service Requests and Billing

### RES-401 — Raise a complaint from the portal `✅ Done`
Category picker (Plumbing, Electrical, Lift, etc.), description, Normal/Urgent priority. Returns ticket ID. Ticket visible in secretary and admin views.

### RES-402 — Track complaint status `✅ Done`
"Track Status" button on each complaint card opens a bottom sheet: 5-step stepper (Raised → Assigned → In Progress → Resolved → Closed) + chronological activity log with actor and timestamp.

### RES-403 — View dues, invoices, and receipts `✅ Done`
Pending and history tabs. Summary cards (pending, overdue, paid count). "Pay Now" link when secretary has set a payment URL. "Receipt" PDF download for paid months.

### RES-404 — Post-resolution service rating `🟠 Medium`
> After a ticket is resolved, resident rates the job 1–5 stars with an optional comment.

**What's needed:** `ticket_ratings` table (ticket_id, resident_id, rating 1-5, comment, created_at). `POST /api/resident/tickets/:id/rate` endpoint (only allowed once, only on RESOLVED/CLOSED tickets). Rating prompt in the complaint detail bottom sheet when status is RESOLVED or CLOSED. Secretary/admin view showing average rating per vendor and per category.

**Acceptance criteria**
- Rating available only after RESOLVED or CLOSED
- One rating per ticket, cannot be changed after submission
- Secretary dashboard shows vendor avg rating and category avg

---

## Epic RES-05: Community and Social Engagement

### RES-501 — Moderated community feed `⬜ Phase 2`
Residents post text/photos; secretary moderates. No existing infrastructure.

### RES-502 — Events and RSVP `✅ Done`
Secretary creates events (title, date/time, location, description). Residents RSVP Going / Maybe / Not Going. Secretary sees live RSVP counts. Events split into Upcoming / Past.

### RES-503 — Polls and surveys `✅ Done`
Secretary creates polls (question, 2–6 options, optional close date). Residents vote once on open polls. Secretary views bar-chart results. Closed polls show final results to residents.

### RES-504 — Buy, sell, and giveaway board `⬜ Phase 2`
Classifieds board within society. Deferred.

---

## Epic RES-06: Convenience and Lifestyle Modules

### RES-601 — Amenity booking `🟠 Medium`
> Reserve the clubhouse, swimming pool, party hall, or gym slot.

**What's needed:** `amenities` table (society_id, name, capacity, rules). `amenity_bookings` table (amenity_id, unit_id, resident_id, date, slot_from, slot_until, status: PENDING/APPROVED/REJECTED/CANCELLED). Secretary approves or auto-approves. Calendar view for secretary. Resident sees own upcoming bookings.

**Acceptance criteria**
- No double-booking for the same amenity slot
- Secretary can approve, reject, or set amenities to auto-approve
- Resident notified on approval/rejection
- Resident can cancel their own upcoming booking

### RES-602 — Society documents library `🟠 Medium`
> Access meeting minutes, society rules, maintenance reports, and circulars.

**What's needed:** `society_documents` table (society_id, title, category, file_url, file_size, uploaded_by, created_at). Secretary uploads PDF/image via multipart or external storage URL. Resident browses by category. Search by title.

**Acceptance criteria**
- Secretary can upload, categorise, and delete documents
- Residents can browse and download
- Categories: Rules & Bye-laws, Financials, Minutes, Notices, Others

### RES-603 — Domestic help and staff access `⬜ Phase 2`
Registry of maids, drivers, and helpers with unit associations. Out of scope for now.

### RES-604 — Packages and lost-and-found `⬜ Phase 2`
Guard logs parcel arrivals; resident gets notified. Deferred.

---

## Epic SEC-01: Secretary Operations (New)

These are pain points a society secretary faces daily that Nexso doesn't yet solve.

### SEC-101 — Secretary ticket management `🟠 Medium`
> Secretary can assign tickets to vendors and mark them resolved — not just view them.

**What's needed:** `PATCH /api/secretary/tickets/:id` endpoint to change status (OPEN → ASSIGNED → IN_PROGRESS → RESOLVED) and set `assigned_vendor_id`. Secretary vendor dropdown (from approved vendors). Update `SecretaryTickets.jsx` to show action buttons inline.

**Acceptance criteria**
- Secretary can assign any open ticket to an approved vendor
- Can advance status (but not skip; machine enforced)
- Resident notified via WhatsApp on assignment (reuse existing notification)
- Status changes logged in ticket_activity_logs

### SEC-102 — Broadcast messaging `🟠 Medium`
> Send a WhatsApp message to all residents, or a filtered subset (overdue payers, specific tower, etc.).

**What's needed:** `POST /api/secretary/broadcast` endpoint. Filters: all, overdue-only, specific tower/floor, specific unit list. Body: free-text message. Log broadcasts to an `outbound_broadcasts` table with sent count + timestamp. Frontend composer in secretary portal.

**Acceptance criteria**
- Target filters: All residents / Tower / Overdue payers / Custom unit list
- Preview recipient count before sending
- Message sent via existing WhatsApp notification service
- Broadcast log shows date, message, recipient count, status

### SEC-103 — Visitor pass oversight `🟠 Medium`
> Secretary sees all active visitor passes across the society, can revoke suspicious ones.

**What's needed:** `GET /api/secretary/visitor-passes` with filters (status, unit, date range). `PATCH /api/secretary/visitor-passes/:id/revoke` secretary-scoped. Secretary passes view in portal: table of active passes, unit, visitor name, validity, revoke button.

**Acceptance criteria**
- Secretary sees all passes (not just one unit)
- Can revoke any active pass with a reason
- Revocation reflected immediately at gate

### SEC-104 — Expense ledger and financial summary `🟠 Medium`
> Track society expenses beyond maintenance dues: security guard salary, generator fuel, cleaning, repairs.

**What's needed:** `society_expenses` table (society_id, month, category, description, amount, receipt_url, created_by, created_at). `GET/POST/DELETE /api/secretary/expenses`. Secretary expense entry form. Monthly P&L summary: maintenance collected vs. total expenses vs. balance. CSV export.

**Acceptance criteria**
- Secretary logs expenses with category (Salary, Utilities, Repairs, Admin, Other) and amount
- Monthly summary shows total collected, total spent, closing balance
- Optional receipt URL or note
- CSV export of expenses for any month range

### SEC-105 — Emergency broadcast `🟠 Medium`
> One-click send of an urgent alert to all residents in the society (water cut, fire drill, power outage).

**What's needed:** Pre-set emergency message templates (Water cut, Power outage, Fire drill, Security alert, Custom). Single confirm-and-send flow. Uses broadcast infrastructure from SEC-102 but with a priority flag. Auto-creates a pinned URGENT announcement alongside the WhatsApp send.

**Acceptance criteria**
- Prominent "Emergency Alert" button on secretary dashboard
- Confirmation step before sending (shows recipient count)
- Simultaneously: sends WhatsApp to all residents + creates pinned URGENT announcement
- Log entry in broadcasts table

### SEC-106 — Vendor ratings and performance view `🟠 Medium`
> Secretary sees which vendors are performing well based on resident feedback (after RES-404 is built).

**What's needed:** Aggregate query over `ticket_ratings` joined with `vendors`. Secretary dashboard widget: top/bottom vendors by avg rating, recent ratings feed, rating trend by month. Depends on RES-404.

**Acceptance criteria**
- Shows avg rating per vendor (only vendors with ≥3 ratings shown)
- Filterable by date range and category
- Individual rating comments visible to secretary

---

## Epic RES-07: Society Admin Controls

### RES-701 — Secretary publishing console `✅ Done`
Announcements (create/edit/delete/pin), Events (create/delete, RSVP view), Polls (create/delete, results) all live in the secretary portal.

### RES-702 — Role permissions and module toggles `🟠 Medium`
> Society admin controls which modules are active for their society.

**What's needed:** `society_module_settings` table (society_id, module_key, enabled). Default all enabled. Settings page in secretary portal. Frontend reads settings on load and hides nav links + routes for disabled modules.

**Acceptance criteria**
- Secretary can toggle: Complaints, Visitor Passes, Events, Polls, Documents, Amenity Booking
- Toggling off hides the module from resident nav immediately
- Disabled module routes return 403 from API

### RES-703 — Moderation, audit logs, and analytics `⬜ Phase 2`
General audit log, moderation queue for community content, adoption analytics. Deferred.

---

## Suggested Build Order (from here)

```
Next sprint — high-value, moderate effort
  SEC-101  Secretary ticket management (assign + status update)
  SEC-102  Broadcast messaging
  RES-404  Post-resolution service rating
  RES-602  Society documents library

Following sprint — operations + engagement
  SEC-103  Visitor pass oversight
  SEC-104  Expense ledger
  SEC-105  Emergency broadcast
  RES-601  Amenity booking

Later — governance + polish
  SEC-106  Vendor ratings view (needs RES-404 first)
  RES-702  Module toggles
  RES-203  Notification center
```
