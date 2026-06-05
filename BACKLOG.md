# Nexso — Resident Portal Backlog

**Legend**
- ✅ Done — fully built
- 🟡 Partial — backend/DB exists, needs resident-facing API or UI
- 🔵 Next — easy to build, data model ready
- 🟠 Medium — new tables + API + UI needed
- ⬜ Phase 2 — defer until MVP is live

---

## Epic RES-01: Resident Identity and Access

### RES-101 — WhatsApp OTP login `🟠 Medium`
> As a resident, I want to log in with my registered WhatsApp number.

**What exists:** WhatsApp send API (`sendWhatsAppText`) works. `residents` table with phone numbers exists.  
**What's needed:** OTP generation + expiry table, send OTP via WhatsApp, verify OTP → mint JWT for `RESIDENT` role in `auth_accounts`.  
**Note:** This is the gating story for the entire resident portal. Nothing else ships without it.

**Acceptance criteria**
- OTP only issued for a phone number that exists in `residents`
- OTP expires after configurable TTL and cannot be reused
- Success → JWT session scoped to correct society + unit

---

### RES-102 — Resident-unit mapping and access control `🟠 Medium`
> After login, the system maps me to my flat automatically.

**What exists:** `residents` → `units` → `towers` → `societies` fully linked in DB. One OWNER + one TENANT enforced per unit.  
**What's needed:** Add `RESIDENT` portal_role to `auth_accounts`. Middleware that scopes all resident API calls to their society_id + unit_id. Multi-unit prompt if one number is linked to more than one unit.

**Acceptance criteria**
- Session is scoped to society + unit after login
- Multi-unit residents choose active unit before entering dashboard
- Resident API calls that reference another unit/society return 403

---

### RES-103 — First-time onboarding and profile setup `🔵 Next`
> On first login, confirm or complete my profile.

**What exists:** `residents` table has name, phone, email, family_members, preferred_contact, bhk, resident_type.  
**What's needed:** `force_profile_setup` flag on auth_accounts (mirrors existing `force_password_reset` pattern). Profile edit endpoint for residents. Simple frontend form.

**Acceptance criteria**
- First login redirects to profile completion before dashboard
- Resident can add/edit household details, vehicles, emergency contact
- Profile is editable at any time from a profile section

---

## Epic RES-02: Resident Dashboard and Communication

### RES-201 — Resident home dashboard `🔵 Next`
> A dashboard that shows what needs my attention.

**What exists:** All underlying data exists — tickets, dues, visitor passes (once built). Admin dashboard pattern in `Dashboard.jsx` to follow.  
**What's needed:** Resident-scoped versions of existing stats endpoints. New `ResidentDashboard.jsx` page.

**Acceptance criteria**
- Shows: open complaints, pending dues, active visitor passes, latest announcements
- Each card links to its module
- Meaningful empty states when a module has no data

---

### RES-202 — Secretary announcements feed `🟠 Medium`
> Receive official announcements from the secretary.

**What exists:** Nothing.  
**What's needed:** New `announcements` table (society_id, title, body, category, priority, audience, pinned, created_by, created_at). Admin publish endpoint. Resident read endpoint (filtered by society, sorted pinned-first). Read tracking per unit for critical notices.

**Acceptance criteria**
- Admins publish with category, priority, audience targeting
- Residents see reverse-chronological feed, pinned urgent notices first
- Critical announcements track read status per unit

---

### RES-203 — Notification center and preferences `⬜ Phase 2`
> See all updates in one place and control non-critical alerts.

**What exists:** WhatsApp + email outbound notifications only. No in-app notification store.  
**What's needed:** `notifications` table, in-app unread count, preference toggles per resident. Significant new infrastructure.

---

## Epic RES-03: Visitor Management

### RES-301 — Create visitor pass `🟠 Medium`
> Create a visitor pass so my guest can enter without delays.

**What exists:** Nothing.  
**What's needed:** `visitor_passes` table (unit_id, society_id, visitor_name, visitor_phone, purpose, valid_from, valid_until, vehicle, pass_code UUID, status: ACTIVE/USED/EXPIRED/REVOKED, created_by).

**Acceptance criteria**
- Required fields validated before pass is created
- Unique pass_code generated per visit
- Validity window enforced

---

### RES-302 — Generate and share visitor card `🟠 Medium`
> A digital visitor card I can send to my guest on WhatsApp.

**What exists:** `sendWhatsAppDocument` and `sendWhatsAppText` in `notifications.js`. PDF generation via `pdfkit` already used for bills.  
**What's needed:** Visitor card PDF/image generator. Share via WhatsApp endpoint reusing existing notification service.

**Acceptance criteria**
- Card shows society, unit, visitor details, validity window, QR/pass code
- Resident can send to visitor's WhatsApp from portal
- Fallback: copy link or download pass if send fails

---

### RES-303 — Security verification and entry/exit logging `🟠 Medium`
> Verify a visitor pass at the gate.

**What exists:** Nothing. No SECURITY portal role exists yet.  
**What's needed:** `SECURITY` portal_role. Verification endpoint (by QR scan, phone, or pass code). Entry/exit timestamp columns on `visitor_passes`. Resident notification on arrival/exit (WhatsApp send exists).

**Acceptance criteria**
- Verify by QR code, mobile number, or pass code
- Clear valid / expired / revoked / already-used states shown
- Entry + exit timestamped, resident notified on both events

---

### RES-304 — Visitor history and revoke pass `🔵 Next`
> View and manage past visitor passes.

**What exists:** Once RES-301 table is built, this is just a filtered list + a status update endpoint.  
**What's needed:** `GET /api/visitor-passes` with filters. `PATCH /api/visitor-passes/:id/revoke`.

**Acceptance criteria**
- Filterable history: upcoming / active / used / expired / revoked
- Resident can revoke any active or unused pass
- Revoked passes blocked immediately at verification

---

## Epic RES-04: Service Requests and Billing

### RES-401 — Raise a complaint from the portal `🟡 Partial`
> Create a complaint without calling the office.

**What exists:** Full ticket backend (`tickets` table, status machine, `createTicketIfNeeded` service). Currently residents raise tickets only via WhatsApp.  
**What's needed:** Resident-scoped `POST /api/resident/tickets` endpoint that calls the same creation service. Resident-facing UI form with category picker + description + optional photo upload.

**Acceptance criteria**
- Category, description, optional attachments
- Returns ticket ID on success
- Ticket visible in both resident and admin workflows

---

### RES-402 — Track complaint status and add updates `🟡 Partial`
> See ticket progress and add follow-up.

**What exists:** `tickets`, `ticket_messages`, `ticket_activity_logs` all populated. Admin sees all of this in `Complaints.jsx`.  
**What's needed:** `GET /api/resident/tickets` scoped to requesting resident's unit. `POST /api/resident/tickets/:id/messages` for resident comments. WhatsApp notification on status change already works.

**Acceptance criteria**
- Resident sees status, assigned vendor (when visible), activity timeline
- Can add comments/media while ticket is open or in-progress
- Notified on every status change

---

### RES-403 — View dues, invoices, and receipts `🟡 Partial`
> See my payment obligations and receipts.

**What exists:** `maintenance_dues` fully populated with amounts, due dates, statuses, Razorpay payment links, PDF bills. `SecretaryMaintenance.jsx` shows this for admins.  
**What's needed:** `GET /api/resident/dues` scoped to the resident's unit. Resident-facing UI. Razorpay payment link passthrough (links already stored on the due row).

**Acceptance criteria**
- Pending dues show amount + due date + pay link
- Overdue dues clearly highlighted
- Paid items in history with receipt/PDF access

---

### RES-404 — Payment reminders and service feedback `🟡 Partial`
> Reminders for dues and a way to rate resolved requests.

**What exists:** `maintenanceScheduler.js` already sends WhatsApp reminders 7 days before due date and marks overdue. Ticket resolved/closed status exists.  
**What's needed:** Post-resolution rating prompt (new `ticket_ratings` table: ticket_id, rating 1-5, comment). Aggregate feedback view for admins.

**Acceptance criteria**
- Reminders fire before due date and after overdue — ✅ already works
- Rating available only after ticket is RESOLVED or CLOSED
- Admin can view ratings by category, vendor, or service type

---

## Epic RES-05: Community and Social Engagement `⬜ Phase 2`

### RES-501 — Moderated community feed
### RES-502 — Events and RSVP
### RES-503 — Polls and surveys
### RES-504 — Buy, sell, and giveaway board

**Status:** Defer. No existing infrastructure. Build after MVP resident portal is live and adopted.

---

## Epic RES-06: Convenience and Lifestyle Modules `⬜ Phase 2`

### RES-601 — Amenity booking
### RES-602 — Society documents library
### RES-603 — Domestic help and staff access
### RES-604 — Packages and lost-and-found

**Status:** Defer. All require new tables, flows, and UI. RES-602 (documents) is the quickest of the four — revisit first.

---

## Epic RES-07: Society Admin Controls and Governance

### RES-701 — Secretary and committee publishing console `🟡 Partial`
> One place to publish resident-facing content.

**What exists:** Secretary portal has resident management, ticket view, maintenance management. No announcement/event/poll publishing.  
**What's needed:** Announcement CRUD in secretary portal (depends on RES-202). Event + poll publishing deferred to Phase 2.

---

### RES-702 — Role permissions and module toggles `🟡 Partial`
> Control which roles access which modules.

**What exists:** `portal_role` on `auth_accounts` (NEXSO_ADMIN, SOCIETY_ADMIN, VENDOR). `requireAdmin` and `requireAuth` middleware. Society-level `maintenance_enabled` toggle.  
**What's needed:** Add RESIDENT + SECURITY roles. Per-society module toggle table (`society_module_settings`). Frontend respects toggles to hide disabled modules.

---

### RES-703 — Moderation, audit logs, and resident analytics `⬜ Phase 2`
> Governance tools, audit trail, and adoption analytics.

**What exists:** `ticket_activity_logs` for ticket audit. Nothing broader.  
**What's needed:** General audit log table. Moderation queue (depends on community features). Analytics dashboard. Defer until Phase 2 features exist.

---

## Implementation Order

```
Sprint 1 — Foundation (nothing else works without these)
  RES-101  WhatsApp OTP login
  RES-102  Resident-unit mapping + RESIDENT role

Sprint 2 — Core resident experience (data already exists)
  RES-401  Raise complaint from portal
  RES-402  Track complaint status
  RES-403  View dues and receipts
  RES-201  Resident dashboard
  RES-103  Profile setup

Sprint 3 — Visitor management
  RES-301  Create visitor pass
  RES-302  Generate and share visitor card
  RES-303  Security verification + entry/exit log
  RES-304  Visitor history + revoke

Sprint 4 — Communication and feedback
  RES-202  Announcements feed
  RES-404  Service feedback / ratings
  RES-701  Secretary publishing console
  RES-702  Role permissions + module toggles

Phase 2 — Community, convenience, governance
  RES-203, RES-501–504, RES-601–604, RES-703
```
