# Business Requirements Document — Nexso Platform

**Version:** 1.0  
**Date:** June 2026  
**Status:** Living document — update as features ship

---

## 1. Executive Summary

Nexso is a society and housing management SaaS platform. It digitises the administrative work of residential societies: resident onboarding, maintenance billing, complaint ticketing, visitor management, and vendor coordination. The platform provides five distinct user-facing portals (Admin, Secretary, Resident, Vendor, Guard) plus a public pass viewer, all backed by a single Express/PostgreSQL API.

---

## 2. User Roles

| Role | Description | Auth Method |
|---|---|---|
| **Nexso Admin** | Platform operator. Manages all societies and vendors. | Username + Password (JWT) |
| **Society Secretary** (`SOCIETY_ADMIN`) | Per-society admin. Manages residents, maintenance, tickets, announcements for one society. | Username + Password (JWT); forced reset on first login |
| **Resident** | Apartment resident. Views announcements, creates visitor passes, views dues. | WhatsApp OTP → JWT |
| **Vendor** | Service provider. Views and updates assigned tickets. | Username + Password (JWT) |
| **Guard** | Society security personnel. Verifies and marks visitor passes. | Username + Password (separate JWT, 12 h expiry) |
| **Public (Visitor)** | No account. Views visitor pass details via a shared link. | None |

---

## 3. Portal Breakdown

### 3.1 Nexso Admin Portal

**Entry point:** `/` (default after login as `NEXSO_ADMIN`)

#### 3.1.1 Society Onboarding

3-step wizard. Each step saves progress; the wizard can be resumed from the society list.

**Step 1 — Basic Info**
- Create a new society: name, address, society type (APARTMENT / VILLA / TOWNSHIP / COMMERCIAL), contact person, phone, email, tower/floor/unit counts.
- System auto-generates a unique Building ID (e.g. `BLD-XYZABC`) used as the secretary's login username.
- System auto-generates a temporary password for the secretary. These credentials are displayed once and must be shared manually.
- Society is created with `onboarding_step = 1`.

**Step 2 — Unit Structure**
- Define towers, floors within each tower, and unit numbers within each floor.
- Each save completely replaces the existing structure (idempotent).
- Society advances to `onboarding_step = 2`.

**Step 3 — Residents**
- Bulk import via Excel (XLSX) upload: columns include name, phone, email, unit number, tower, resident type, BHK, maintenance amount, maintenance due day.
- Or add residents one by one from the Society Detail view.
- Rules: one OWNER and one TENANT per unit. Conflicts are flagged per row; valid rows are still imported.
- Society advances to `onboarding_step = 3`.

**Additional society management:**
- Edit basic society info.
- Reset secretary password (generates a new temporary password; old one is invalidated).
- Set up / replace the guard account (username + password).
- View society detail: tower/floor/unit tree with unit-level residents.

#### 3.1.2 Vendor Management

- List vendors with verification status filter.
- Add vendor: name, business name, owner name, categories, WhatsApp number, phone, email, GST, team size, emergency availability flag.
- Approve, reject (with reason), or suspend (with reason) a vendor.
- Suspension audit trail in `vendor_suspensions`.
- Upload vendor documents (admin-managed).
- Assign vendor to service areas (society-level).

#### 3.1.3 Ticket Management (Admin view)

- View all tickets across societies.
- Filter by status: `OPEN / ASSIGNED / IN_PROGRESS / RESOLVED / CLOSED`.
- Ticket lifecycle: `OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`.
- Ticket escalation tracked via `escalated_at`.

#### 3.1.4 User Management

- View WhatsApp users (residents who registered via WhatsApp).

#### 3.1.5 Payments & Complaints

- Payments page: view payment records.
- Complaints page: separate complaint tracking.

#### 3.1.6 Maintenance (Admin view)

- View maintenance dues across societies.

---

### 3.2 Secretary Portal

**Entry point:** `/secretary` (after login as `SOCIETY_ADMIN`)

All data is scoped to the secretary's society via the JWT. The secretary can never access another society's data.

#### 3.2.1 Dashboard

- Quick stats: total residents, pending invitations, total units, open tickets, in-progress tickets, resolved tickets.
- Society name and summary shown prominently.

#### 3.2.2 Resident Management

**List:**
- Show all residents with unit number, tower name, maintenance settings.
- Search by name, unit number, or phone.
- Sorted by tower → unit → name.

**Add Resident:**
- Fields: unit (dropdown), name, phone, email, Aadhar number, preferred contact (WHATSAPP / SMS / EMAIL), BHK, resident type (OWNER / TENANT), family members count.
- Maintenance settings: enabled toggle, monthly amount, due day.
- Occupancy rule enforced: each unit may have at most one OWNER and one TENANT.

**Edit Resident:**
- All fields from add form are editable.
- Occupancy conflict check before update (returns 409 if the new resident_type slot is already taken by another resident in the same unit).

**Delete Resident:**
- Removes resident; cascades to maintenance dues.

**Structure Preview:**
- Visual tower/floor/unit grid showing which units are occupied.
- Click an empty unit chip to pre-fill the Add Resident form for that unit.

#### 3.2.3 Ticket Management

- View tickets for the society filtered by status.
- Pagination (default 50 per page).

#### 3.2.4 Announcements

- **Create:** title, body, category (freeform), priority (NORMAL / URGENT), pinned toggle.
- **Edit:** all fields.
- **Delete.**
- Announcements are ordered: pinned first, then by creation date descending.

#### 3.2.5 Maintenance

**Configuration:**
- Enable/disable maintenance collection for the society.
- Set society UPI ID (used in payment reminders and invoices).

**Per-unit Settings** (managed via resident forms):
- Enabled toggle.
- Monthly base amount (₹).
- Due day of month (1–31).

**Expense Sheet (monthly):**
- Two sections: Fixed items and Variable items. Each item has a particulars name and total amount.
- Default fixed items: Sinking Fund, Structural Repair Fee, Insurance, Parking Fee, Security Fee, Housekeeping Fee, Society Management Fee, Lift Maintenance AMC.
- Default variable items: Garbage Collection Fee, Electricity Bill, Generator Fuel, Water Tank Cleaning, Non-Occupancy Charges.
- Interest rate (annual, default 21%) used to compute interest on previous-month dues.
- Sheet is saved per society per month. Missing months use the default template.

**Bill Generation:**
- Triggered manually for a selected month.
- For each unit with maintenance enabled:
  - Identifies the current occupant (TENANT preferred, else OWNER).
  - Calculates total = base amount + expense share (total expenses ÷ number of enabled units).
  - Creates a `maintenance_dues` row (idempotent — skips if already exists for that resident+month).
  - Stores a breakdown snapshot (fixed items, variable items, unit count) on the due row for future PDF accuracy.
  - Optionally creates a Razorpay payment link if Razorpay is configured.
- Returns: `{ created, skipped, month, razorpay }`.

**Bill Preview:**
- Compute itemised bill for a specific resident and month without generating a due.
- Includes: base amount, fixed items per-unit, variable items per-unit, previously unpaid dues, interest on overdue, total.

**Invoice PDF:**
- Download the maintenance bill PDF for a specific due.
- Auto-assigns a sequential invoice number (format: `SOC-CODE/YYYY-MM/NNN`) on first download; stored in `maintenance_invoices`.
- PDF includes: society name & address, resident name, unit, invoice number, itemised bill breakdown, payment link / UPI QR.

**Payment Reminders:**
- Send reminders to all PENDING dues in a month that are within 7 days of due date and haven't been reminded yet.
- Channel preference: email first (via SMTP), WhatsApp fallback.
- Message includes amount, due date, payment link (if Razorpay), or UPI ID.
- Records `reminder_sent_at` to prevent duplicate sends.

**Collection Register PDF:**
- Full list of dues for a month with resident names, units, amounts, statuses.
- Summary: total billed, total collected, pending/overdue/waived counts.
- Includes closure status watermark if month is closed.

**Month Closure:**
- Flips all PENDING dues in the month to OVERDUE.
- Computes and stores totals: total dues, total billed, total collected, total waived, total overdue, total expenses, surplus/deficit.
- Records who closed the month and when.
- Closed months are locked: due status updates are rejected with a 403 until reopened.

**Month Reopening:**
- Requires a written reason (audit trail).
- Records who reopened and when.

**Closure Summary PDF:**
- Summary of a closed month: collection stats, expense breakdown, surplus/deficit.
- Only available after month is closed.

**Monthly Tally:**
- Multi-month table: one row per month with billed, collected, waived, overdue, expenses, surplus/deficit, and closure status.
- Filterable by year.

**Due Status Manual Update:**
- Mark a due as PAID (with optional payment reference), WAIVED, or OVERDUE manually.
- Blocked if the month is closed.

#### 3.2.6 Profile

- Change password.
- Logout.

---

### 3.3 Resident Portal

**Entry point:** `/resident` (after OTP login)

#### 3.3.1 Authentication

1. Enter registered WhatsApp number.
2. OTP is sent to that number via WhatsApp (or shown in dev mode).
3. Enter 6-digit OTP. Verified against `otp_tokens` table (tokens expire after a short window).
4. On success: JWT is issued with `residentId`, `unitId`, `unitNumber`, `societyId`, `societyName`.

#### 3.3.2 Dashboard

- Greeting with resident's name, unit number, society name.

#### 3.3.3 Announcements

- Read-only list of society announcements.
- Pinned announcements shown first, then URGENT, then regular.
- Each card shows title, body, category badge, date, pinned/urgent indicators.

#### 3.3.4 Visitor Passes

**Create pass:**
- Visitor name (required), visitor phone, purpose, vehicle number.
- Valid from (datetime), Valid until (datetime). End must be after start.
- System generates a unique `pass_code` (alphanumeric, uppercase).

**View passes:**
- All passes for the resident's unit sorted by creation date.
- Status: ACTIVE / USED / EXPIRED / REVOKED.

**Share pass:**
- Bottom sheet with: copy link, WhatsApp share, Gmail compose, email client, native Web Share API.
- Shared message includes pass code, validity window, purpose, and direct link.

**Revoke pass:**
- Resident can revoke any ACTIVE pass (sets status to REVOKED).

---

### 3.4 Vendor Portal

**Entry point:** `/vendor` (after login as `VENDOR`)

#### 3.4.1 Dashboard

- Welcome screen with vendor name and stats.

#### 3.4.2 Tickets

- View tickets assigned to this vendor.
- Update ticket status.

#### 3.4.3 Profile

- View vendor details.
- Change password.

---

### 3.5 Guard Portal

**Entry point:** `/guard` (separate route, no shared session with main app)

#### 3.5.1 Login

- Username + password.
- JWT valid for 12 hours.
- Shows society name after login.

#### 3.5.2 Pass Verification

- Enter or scan a pass code.
- System auto-expires any ACTIVE passes whose `valid_until` has passed before lookup.
- Returns: visitor name, phone, purpose, vehicle, unit, tower, resident name, validity window, status.
- Displays whether the pass is currently usable (ACTIVE + within validity window).

#### 3.5.3 Mark Pass as Used

- Guard taps "Mark as Used" on a valid ACTIVE pass.
- Sets status to USED. Cannot be undone.
- Rejects if pass is already USED, EXPIRED, or REVOKED.

---

### 3.6 Public Pass Page

**Entry point:** `/pass/:passCode`

- No authentication required.
- Shows visitor pass details: visitor name, purpose, vehicle, unit, tower, society name, address, validity window, status.
- Phone number and resident identity are NOT exposed.
- Used by visitors to confirm their pass details before arriving at the gate.

---

## 4. Background Services

| Service | Trigger | Behaviour |
|---|---|---|
| **Maintenance Scheduler** | Cron (monthly) | Auto-generates dues for all societies with enabled maintenance settings |
| **Ticket Escalation** | Cron | Flags long-open tickets by setting `escalated_at` |
| **Razorpay Webhook** | HTTP POST from Razorpay | Updates due status to PAID when payment is confirmed |

---

## 5. Integrations

| Integration | Purpose |
|---|---|
| **WhatsApp (Meta Cloud API)** | Inbound: resident message-to-ticket (webhook). Outbound: OTP delivery, maintenance reminders, ticket notifications |
| **Razorpay** | Payment link creation per maintenance due; webhook to confirm payment |
| **Email (SMTP / Nodemailer)** | Maintenance reminder emails (preferred over WhatsApp when email is on file) |
| **Excel (XLSX)** | Bulk resident import template; download + upload flow in onboarding Step 3 |

---

## 6. Data Model Summary

| Table | Key Columns | Notes |
|---|---|---|
| `societies` | id, name, code, building_id, society_type, onboarding_step | One row per society |
| `towers` | id, society_id, name, num_floors | |
| `floors` | id, tower_id, society_id, floor_number | |
| `units` | id, floor_id, tower_id, society_id, unit_number | |
| `residents` | id, unit_id, society_id, name, phone, email, resident_type, invitation_status | OWNER or TENANT; unique per slot per unit |
| `auth_accounts` | id, username, portal_role, society_id, vendor_id, resident_id, force_password_reset | All web-portal logins |
| `guard_accounts` | id, society_id, username | Separate from auth_accounts |
| `otp_tokens` | id, phone, otp_code, expires_at, used | Resident WhatsApp OTP |
| `vendors` | id, name, verification_status, categories | |
| `tickets` | id, ticket_id, society_id, status, category, assigned_vendor_id, unit_id | Status lifecycle enforced by DB constraint |
| `maintenance_settings` | id, unit_id (unique), society_id, enabled, amount, due_day | One row per unit |
| `maintenance_dues` | id, resident_id, society_id, due_month, amount, status, breakdown | Unique per resident+month |
| `maintenance_expense_sheets` | id, society_id, month, fixed_items, variable_items, interest_rate | Unique per society+month |
| `maintenance_invoices` | id, due_id, invoice_number | Sequential per society; assigned on first PDF download |
| `monthly_closures` | id, society_id, month, status, totals, closed_by | OPEN or CLOSED |
| `announcements` | id, society_id, title, body, category, priority, pinned | |
| `visitor_passes` | id, unit_id, society_id, resident_id, pass_code (unique), status | ACTIVE / USED / EXPIRED / REVOKED |
| `whatsapp_sessions` | id, whatsapp_number, state, context | Multi-turn registration flow state |

---

## 7. Business Rules

1. **Unit occupancy:** Each unit may have at most one resident of type OWNER and one of type TENANT. Attempts to add a duplicate type return HTTP 409.
2. **Maintenance bill generation:** If a unit has no occupant, that unit is skipped. TENANT is billed before OWNER if both exist.
3. **Expense share:** Total expenses from the expense sheet are divided equally among all units with maintenance enabled. Stored in the due's `breakdown` for future PDF accuracy even if the sheet changes.
4. **Month closure locks dues:** Once a month is CLOSED, any PATCH to a due in that month returns HTTP 403. Secretary must reopen the month (with a reason) before editing.
5. **Invoice numbers:** Assigned on first PDF download, never reassigned. Format: `SOCIETYCODE/YYYY-MM/NNN` (NNN is zero-padded sequential per society).
6. **Pass auto-expiry:** Any ACTIVE pass whose `valid_until` has passed is automatically set to EXPIRED on the next lookup (by guard or by public page). No scheduled job required.
7. **OTP login:** A phone number must appear in the `residents` table to receive an OTP. Unknown numbers are rejected with `phone_not_registered`.
8. **Force password reset:** Newly created secretary and vendor accounts have `force_password_reset = TRUE`. The user sees a mandatory password change screen before accessing any page.
9. **Secretary data isolation:** The `societyId` in the JWT is the single source of truth — it is never taken from URL parameters. A secretary cannot query or modify another society's data.
10. **Reminder deduplication:** `reminder_sent_at` is set on the due after a reminder is sent. Only dues with `reminder_sent_at IS NULL` are eligible, preventing duplicate reminders on re-runs.

---

## 8. Authentication & Session Model

| Portal | Token storage | Expiry | Scope |
|---|---|---|---|
| Admin / Secretary / Vendor / Resident | `localStorage` (key: `nexso_session`) | Configurable (default 7 d) | Role-scoped routes |
| Guard | `localStorage` (key: `nexso_guard_session` + `nexso_guard_token`) | 12 h | Guard routes only |

On 401, the frontend fires `nexso:unauthorized` DOM event. The app listens, clears the session, and redirects to login.

---

## 9. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Security** | Passwords hashed with bcrypt (cost 12). JWT signed with `JWT_SECRET`. CORS restricted to `CORS_ORIGIN` env var. Rate limiting on all API routes (express-rate-limit). Helmet for HTTP headers. |
| **Data isolation** | Society-scoped endpoints derive `society_id` from JWT only. No cross-society data leakage by design. |
| **Graceful degradation** | Backend starts and serves requests even when the database is unavailable (`isDbConnected()` check). |
| **Idempotency** | Structure saves (Step 2), resident imports, and maintenance bill generation are all idempotent. Re-running does not create duplicates. |
| **PDF generation** | Server-side, using pdfkit. No client-side dependencies. |
| **Mobile-first UI** | Resident and Guard portals are designed for mobile screens. Admin/Secretary portals are desktop-primary (Fluent UI). |

---

## 10. Known Gaps / Future Scope

| Area | Gap |
|---|---|
| **Resident portal — Maintenance dues** | Residents cannot yet view their own due history or download invoices |
| **Resident portal — Tickets** | Residents cannot raise or track tickets from the portal |
| **Vendor portal** | Limited to viewing assigned tickets; no quote/invoice flow |
| **WhatsApp ticket ingestion** | Inbound webhook and session flow exist but are not fully integrated into the secretary UI |
| **Multi-language** | All UI is English-only |
| **Notifications — guard** | No push notification when a new visitor pass is created for the guard's society |
| **Maintenance — bulk waive** | No bulk waive or bulk mark-paid action |
| **Audit log** | Ticket activity log exists; no unified audit log for other entity changes (resident edits, announcement edits) |
| **Reporting** | No exportable reports beyond PDF. No CSV export, no charts |
