# Nexso — Go-Live Checklist

> **Last updated:** 2026-06-02  
> **Branch:** feature/registration-improvements  
> Legend: ✅ Done · 🔧 Code exists, needs config/testing · ⚠️ Partially built · ❌ Not built yet

---

## 0. Critical Path Overview

The full lifecycle we need to verify end-to-end before going live:

```
Resident sends WhatsApp message
  → Platform registers them (if new) with welcome message
  → Ticket created
  → Admin sees it on dashboard
  → Admin assigns to vendor (or auto-assign fires)
  → Vendor gets WhatsApp notification
  → Vendor logs into portal, moves ticket ASSIGNED → IN_PROGRESS → RESOLVED
  → Resident gets WhatsApp update "your issue is fixed"
  → Admin closes ticket
  → Admin records vendor payment
  → Maintenance dues generated on 1st of month
  → Resident gets Razorpay payment link
  → Resident pays
  → Due auto-marked PAID via webhook
```

---

## 1. WhatsApp & Resident Experience

### 1.1 Registration Model
- ✅ **Secretary-managed registration** — Residents are pre-added by the society secretary via the Residents tab in the secretary portal. There is no self-registration flow; this is by design.
- ✅ **Unknown number handling** — If an unregistered number messages the WhatsApp number, the webhook replies: *"Hi! Your number isn't registered with our society management system. Please contact your society secretary to get added."* No further action is taken.
- ✅ **Registered resident onboarding** — Once added by the secretary, a resident can immediately start raising complaints by texting the WhatsApp number. A greeting (hi/hello) sends them an interactive category menu; any complaint text directly creates a ticket.

### 1.2 Ticket Notifications to Resident
- ✅ **Ticket created confirmation** — `tickets.js` sends a WhatsApp to the resident when a ticket is created (ticket ID + status).
- ✅ **Status change notifications** — `tickets.js` PATCH endpoint sends WhatsApp to the resident's registered number for every status transition: ASSIGNED (includes vendor name), IN_PROGRESS, RESOLVED, and CLOSED.
- ✅ **Closure confirmation** — Handled inline in the status change notification above; CLOSED status sends a closure message to the resident.

---

## 2. Ticket Lifecycle — Admin Side

### 2.1 Ticket Creation from WhatsApp
- 🔧 **Local end-to-end test** — Run the backend locally with ngrok pointing to `POST /webhook/whatsapp`, send a WhatsApp message from a real phone, verify:
  - Message is received and persisted in `whatsapp_messages`
  - Identity is resolved (or registration flow triggers)
  - Ticket row is created in `tickets`
  - Admin dashboard shows it in real time (requires a browser refresh currently — see §2.3)
- ⚠️ **Category classification** — `inferCategory()` only detects PLUMBING, ELECTRICAL, SECURITY, GENERAL using keyword matching. Before launch, extend this with more keywords or add a simple LLM call for intent detection. Wrong categories = wrong vendor assignment.
- ❌ **Photo/media from WhatsApp** — When residents send an image with their complaint, `message_type` comes in as `image` but the current webhook code stores it in `raw_message_payload` but doesn't download/store the media URL. Residents often want to attach photos. Wire up the Meta media download API.

### 2.2 Admin — Assign to Vendor
- ✅ **Manual assignment** — Admin can assign via `PATCH /api/tickets/:id` from the dashboard.
- 🔧 **Auto-assign** — `AUTO_ASSIGN=true` in `.env` will auto-assign to first available APPROVED vendor in that category. Verify this works end-to-end; currently `notifyVendor()` is a **stub** (see §3.1).
- ❌ **Admin notification on new ticket** — Admin only sees new tickets when they refresh the dashboard. For live usage, add either:
  - Browser notification / sound on new ticket (polling or WebSocket)
  - WhatsApp/email to admin phone when a ticket arrives

### 2.3 Real-Time / Refresh
- ❌ **Dashboard auto-refresh** — Tickets page is static; admin must manually reload. Add a polling interval (e.g. `setInterval` every 30s) or WebSocket push so new tickets appear automatically.

---

## 3. Vendor Portal

### 3.1 Vendor Notification (Assigned Ticket)
- ❌ **`notifyVendor()` is a stub** — In `services/notifications.js`, `notifyVendor()` only writes an activity log entry. It does **not** send a WhatsApp message to the vendor. This means vendors won't know about new tickets unless they log into the portal and check.
  - **Fix:** Call `sendWhatsAppText(vendor.whatsapp_number, message)` inside `notifyVendor()`.
  - **Message:** "New job assigned! Ticket #T-xxxxx — [Category] at [Society Name / Apartment]. Log in to Nexso Vendor Portal to accept: [URL]"

### 3.2 Vendor Login & Portal
- ✅ **Vendor portal built** — Dashboard, tickets list, status update (ASSIGNED → IN_PROGRESS → RESOLVED) all exist.
- 🔧 **Vendor credentials** — Create the vendor and its portal login from the admin portal (Vendors → add, then issue credentials; `routes/vendor.js` mints the `VENDOR` auth account). Test login end-to-end. *(The old `seed-vendor.js` script was removed — the API path supersedes it.)*
- ✅ **Status transitions** — Vendor can only advance (ASSIGNED → IN_PROGRESS → RESOLVED), enforced server-side.
- ❌ **Vendor notification to resident** — When vendor marks IN_PROGRESS, resident should get "Technician is on the way" — not implemented.

### 3.3 Vendor Payment — **BIGGEST GAP**
This is the most under-designed area. Currently there is **zero** mechanism for paying vendors after they resolve a job.

**Questions to decide before building:**
- Is the society paying the vendor? Or does the resident pay directly?
- Is it a fixed rate per ticket category, or do vendors quote a price?
- Does the vendor submit a bill/invoice after resolution?
- Does admin approve the invoice and then transfer money?

**What needs to be built (suggested approach):**
- ❌ **Vendor quotes / invoice on ticket** — After marking IN_PROGRESS, vendor can enter "Estimated cost: ₹500". After marking RESOLVED, vendor submits a final invoice amount.
- ❌ **Admin payment approval** — Admin sees pending vendor invoices, approves them, records payment method (bank transfer, UPI, cash).
- ❌ **`vendor_payments` table** — New DB table: `ticket_id, vendor_id, invoice_amount, approved_amount, payment_method, payment_reference, paid_at, status (PENDING/APPROVED/PAID)`.
- ❌ **Vendor earnings view** — Vendor portal "Earnings" tab showing: completed jobs, pending payment, paid, total earned this month.
- ❌ **Admin payments screen** — Already has a `/payments` page in the frontend — wire it up to show vendor payment queue, not just maintenance dues.

---

## 4. Maintenance Collection (Resident Payments)

### 4.1 Razorpay Integration
- 🔧 **Razorpay keys not set** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` are all blank in `.env`. Get these from `dashboard.razorpay.com → Settings → API Keys`.
- 🔧 **Webhook registration** — Register `POST /webhook/razorpay` in Razorpay dashboard with the secret. Without this, payments won't auto-mark dues as PAID.
- 🔧 **Payment link generation** — Code is complete; once Razorpay keys are set, test `POST /api/maintenance/generate` and verify payment links appear in dues.
- ✅ **Auto-mark PAID on webhook** — Code complete in `routes/razorpayWebhook.js`.

### 4.2 Maintenance Scheduler (Cron Jobs)
- ✅ **Scheduler built** — `startMaintenanceScheduler()` in `services/maintenanceScheduler.js` is wired into server startup (verify in `server.js`).
- 🔧 **Verify scheduler is called at startup** — Check that `server.js` calls `startMaintenanceScheduler()`.
- 🔧 **Test manually** — Before relying on the cron, manually call `POST /api/maintenance/generate` with a test month and verify dues rows are created with correct amounts and Razorpay links.
- ❌ **Overdue escalation** — OVERDUE dues sweep is coded, but there's no WhatsApp reminder or second notice to overdue residents. Add a second "overdue" reminder template.

### 4.4 Monthly Expense Sheet (Itemised Bill Builder) ✅

The secretary portal's **Maintenance → Expense Sheet** tab lets the secretary break down the society's monthly expenses into individual line items, which are then divided equally among all residents who have maintenance enabled.

**How it works:**

1. **Secretary fills the Expense Sheet** (per month):
   - *Fixed Maintenance Fees* — Sinking Fund, Structural Repair Fee, Insurance, Parking Fee, Security Fee, Housekeeping Fee, Society Management Fee, Lift Maintenance AMC
   - *Variable Maintenance Fees* — Garbage Collection Fee, Electricity Bill, Generator Fuel, Water Tank Cleaning Fee, Non-Occupancy Charges
   - Custom rows can be added to either section
   - Secretary enters the **total society amount** for each item; the per-unit share is calculated automatically (`total ÷ number of enabled residents`)
   - An interest rate (default 21% p.a.) is configurable for arrear calculations

2. **Preview Bill** — Before generating, the secretary can select any maintenance-enabled resident from a dropdown and see a formatted invoice showing:
   - Fixed and variable line items with their per-unit amounts
   - Base maintenance amount (resident-specific)
   - Previous month's unpaid dues (auto-looked up from DB)
   - Interest on arrears
   - Grand total
   - Society name and address in the invoice header
   - Print-ready layout (`window.print()`)

3. **Generate Dues** — Once the expense sheet is saved, clicking "Generate Dues" in the Dues Collection tab creates `maintenance_dues` records where each resident's amount = `base_maintenance_amount + per_unit_expense_share`. The breakdown is stored as JSONB on the due record for future reference.

4. **Maintenance Collection toggle** — Master on/off switch for the society. When ON, the scheduler auto-generates dues on the 1st of every month and sends reminders 7 days before the due date. The expense sheet is optional — without it, dues fall back to each resident's base amount only.

**DB tables added:**
- `maintenance_expense_sheets` — stores fixed/variable line items + interest rate per society per month
- `maintenance_dues` extended with: `breakdown` (JSONB), `base_amount`, `expense_share`, `previously_due`, `interest_amount`

**Testing checklist:**
- [ ] Enable maintenance for at least one resident (Residents tab → Edit → toggle on, set amount + due day)
- [ ] Go to Maintenance → Expense Sheet, enter amounts, click Save
- [ ] Click Preview Bill, select a resident — verify amounts and totals are correct
- [ ] Switch to Dues Collection tab, click Generate Dues — verify due = base + expense share
- [ ] Confirm "Maintenance" column in Residents table shows enabled status + base amount

### 4.3 Email Reminders
- 🔧 **SMTP not configured** — `EMAIL_USER` and `EMAIL_PASS` are blank. Configure a Gmail App Password or an SMTP service (Mailgun, SendGrid) for production.
- 🔧 **Test email template** — Send a test reminder manually to verify the HTML email renders correctly.

---

## 5. Infrastructure & Production Deployment

### 5.1 Public URL for WhatsApp Webhook
- 🔧 **ngrok for local testing** — Run `ngrok http 3000`, set the HTTPS forwarding URL in Meta's webhook settings: `https://xxxx.ngrok.io/webhook/whatsapp`.
- ❌ **Production server** — Need a VPS / PaaS (Railway, Render, DigitalOcean, etc.) with:
  - HTTPS with a real domain (Meta requires HTTPS)
  - Always-on process (PM2 or Docker)
  - PostgreSQL database (Railway Postgres, Supabase, or RDS)

### 5.2 Environment Variables — Production Secrets
All of these need real values before go-live:

| Variable | Status | Action |
|---|---|---|
| `JWT_SECRET` | ❌ dev default | Generate: `openssl rand -base64 32` |
| `DATABASE_URL` | 🔧 local | Point to prod Postgres |
| `CORS_ORIGIN` | ❌ not set | Set to frontend domain |
| `WHATSAPP_TOKEN` | ✅ set | Verify not expired (tokens expire) |
| `WHATSAPP_APP_SECRET` | ❌ blank | Fill from Meta App settings |
| `WHATSAPP_VERIFY_TOKEN` | 🔧 dev default | Change to a random string |
| `RAZORPAY_KEY_ID` | ❌ blank | Fill from Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | ❌ blank | Fill from Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | ❌ blank | Fill from Razorpay dashboard |
| `EMAIL_USER` | ❌ blank | Configure SMTP |
| `EMAIL_PASS` | ❌ blank | Configure SMTP |
| `BACKEND_PUBLIC_URL` | ❌ blank | Set to your deployed backend domain (e.g. `https://api.yourdomain.com`) — required for WhatsApp bill PDF delivery; reminders fall back to text-only without it |

### 5.3 Database
- ❌ **Backup strategy** — No automated backups configured. Set up daily pg_dump to S3 or use managed DB with point-in-time recovery.
- ❌ **Schema migrations** — Currently `npm run db:schema` reruns the full schema. For production, build a proper migration system (or use a tool like Flyway/node-pg-migrate) so schema can be updated without dropping data.
- ❌ **Connection pooling** — Check if `db/index.js` uses a connection pool (it should for prod load). Confirm `pg.Pool` is used, not `pg.Client`.

### 5.4 Security Hardening
- ❌ **Rate limiting** — No rate limiting on `/webhook/whatsapp` or `/api/auth/login`. A spam flood or brute-force attack will bring the server down or exhaust Razorpay/WhatsApp quotas.  Add `express-rate-limit`.
- ❌ **Helmet / security headers** — Add `helmet()` middleware for standard HTTP security headers.
- ❌ **Input validation** — Most routes trust `req.body` directly. Add `zod` or `joi` validation on critical endpoints.
- ❌ **CORS in production** — `CORS_ORIGIN` is not set; ensure it's locked to the frontend domain, not `*`.
- 🔧 **WhatsApp signature verification** — Code validates `x-hub-signature-256` but `WHATSAPP_APP_SECRET` is blank in `.env`. Without this, the webhook accepts requests from anyone. Fill it in.

---

## 6. Admin Portal — Missing Screens / Gaps

### 6.1 Payments Page
- ⚠️ **Payments page exists** (`/payments`) but likely shows maintenance dues only. Extend it to show vendor payment queue (see §3.3).

### 6.2 Force Password Reset
- ⚠️ **`force_password_reset` flag** exists on `auth_accounts` but there's no frontend prompt for it. When a vendor or secretary logs in with a temp password, they should be forced to change it before accessing the portal.

### 6.3 Admin Notifications
- ❌ **No notification bell** — Admin dashboard has no notification count for new/unassigned tickets. Add a badge on the Tickets nav link showing open ticket count.

### 6.4 Secretary Portal
- ⚠️ **Secretary portal pages built** (dashboard, maintenance, residents, tickets) but untested end-to-end with a real `SECRETARY` role login.
- ❌ **Secretary WhatsApp number** — Secretary may need to receive WhatsApp notifications for their society's tickets too (not just admin).

---

## 7. End-to-End Test Scenarios

Run through each of these manually before launch:

### Scenario A — New Resident Complaint
1. Send a WhatsApp message from an unknown number to your business number.
2. Verify registration flow triggers (welcome message or Flow template sent back).
3. Complete registration (society code + flat number).
4. Send complaint text ("water leakage in bathroom").
5. Verify ticket created in DB and appears on admin dashboard.
6. Admin assigns to a vendor.
7. Vendor receives WhatsApp notification.
8. Vendor logs into portal → moves to IN_PROGRESS → RESOLVED.
9. Verify resident gets WhatsApp update at each stage.
10. Admin closes ticket.

### Scenario B — Maintenance Collection
1. Onboard a test society with 2 residents.
2. Set base maintenance amount (₹2,000) and due date (5th of month) for each resident (Residents tab → Edit).
3. Go to Maintenance → Expense Sheet tab. Enter total society amounts for at least a few line items (e.g. Security Fee ₹10,000, Electricity Bill ₹5,000). Click Save.
4. Click Preview Bill — select a resident and verify the invoice shows correct per-unit breakdown + base amount + total.
5. Switch to Dues Collection tab. Click Generate Dues.
6. Verify dues rows created in DB: `amount` should equal `base_amount + expense_share`. Confirm `breakdown` JSONB is populated.
7. Verify Razorpay payment links appear in the dues table (requires Razorpay keys configured).
8. Manually trigger `POST /api/maintenance/send-reminders`.
9. Verify WhatsApp / email sent with payment link.
10. Simulate Razorpay webhook `payment_link.paid` event using Razorpay's test mode.
11. Verify due is marked PAID in DB.
12. Verify admin dashboard shows correct collection stats.

### Scenario C — Vendor Login Flow
1. Create a vendor via admin portal.
2. Approve vendor in verification queue.
3. Verify vendor receives login credentials (or admin sets them).
4. Vendor logs in → sees dashboard → views assigned ticket → resolves it.
5. Vendor submits invoice/payment claim (once §3.3 is built).

### Scenario D — Society Onboarding
1. Admin creates new society via 3-step wizard.
2. Verify towers/floors/units are created correctly.
3. Import residents from Excel.
4. Verify residents appear in Users list.
5. Assign secretary to society.
6. Secretary logs in, sees their society's tickets and residents.

---

## 8. Nice-to-Have Before Launch (Not Blockers)

- ❌ **Ticket priority escalation** — NORMAL tickets that stay OPEN for 48h should auto-escalate to HIGH priority.
- ❌ **Vendor rating** — After ticket is CLOSED, ask resident via WhatsApp: "Rate your service 1–5 ⭐". Store in DB.
- ❌ **Admin analytics** — Charts showing tickets over time, top complaint categories, resolution time, collection rate %.
- ❌ **Multi-language WhatsApp** — Hindi + regional language support for WhatsApp messages.
- ❌ **Tenant vs. Owner distinction** — Role exists in DB but both get treated the same way in the ticket flow.
- ❌ **Maintenance receipt** — After payment, send resident a WhatsApp/email receipt with payment reference and month.
- ❌ **Vendor document expiry alerts** — If a vendor's license/insurance is about to expire, alert admin.
- ❌ **Offline payment recording** — Some residents may pay by cash/NEFT. Admin needs a "Mark as manually paid" button with reference note (already exists via PATCH dues endpoint — just needs a UI button).

---

## 9. Pre-Launch Checklist (Tick before going live)

- [ ] All production env vars filled in (see §5.2 table)
- [ ] WhatsApp App Secret set and signature verification tested
- [ ] Razorpay keys set, test payment created and paid in test mode
- [ ] Razorpay webhook registered and tested
- [ ] SMTP email configured and test email sent
- [ ] `BACKEND_PUBLIC_URL` set to deployed backend domain so maintenance bill PDFs are sent via WhatsApp
- [ ] `notifyVendor()` sends real WhatsApp messages
- [ ] Resident gets WhatsApp when ticket is RESOLVED
- [ ] End-to-end Scenario A completed successfully
- [ ] End-to-end Scenario B completed successfully
- [ ] Production server running with HTTPS
- [ ] JWT_SECRET changed from dev default
- [ ] CORS_ORIGIN set to frontend domain
- [ ] Rate limiting added on auth and webhook routes
- [ ] Database daily backups configured
- [ ] At least one admin account with a strong password created
- [ ] Vendor payment model designed and at minimum a basic tracking table created
- [ ] Force password reset UI implemented for vendor/secretary first login

---

## 10. Open Questions / Decisions Needed

| # | Question | Who decides |
|---|---|---|
| 1 | **Vendor payment model** — Fixed rate per category, or vendor-submitted invoice? | Product |
| 2 | **Who pays vendor?** — Society pays from maintenance collection pool, or resident pays vendor directly? | Product |
| 3 | **Razorpay account** — Use one Razorpay account for all societies, or a sub-account per society? | Finance |
| 4 | **WhatsApp Business number** — Is the current number production-ready, or is it a test number? | Ops |
| 5 | **Multi-society isolation** — Can a vendor work across multiple societies, or is each vendor locked to one society? | Product |
| 6 | **Vendor onboarding** — Does the vendor self-register via a form, or does admin create them? | Product |
| 7 | **Data retention** — How long to keep closed tickets, WhatsApp message logs, payment records? | Legal |
| 8 | **Society code sharing** — How does a secretary share the society code with residents? QR code? Printed slip? | Ops |
