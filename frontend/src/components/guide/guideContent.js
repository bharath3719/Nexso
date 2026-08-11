/**
 * guideContent.js
 * ────────────────
 * Content for the in-app Guide, keyed by portal role.
 *
 * This is deliberately plain data (no JSX) so the copy stays easy to edit by
 * anyone — GuideDrawer.jsx renders it. Every claim here is derived from the
 * actual routes/schedulers, so when behaviour changes, change the copy too:
 *
 *   dues + closure rules   → backend/src/routes/secretary.js
 *   cron timings           → backend/src/services/maintenanceScheduler.js
 *   ticket escalation      → backend/src/services/ticketEscalationScheduler.js
 *   vendor transitions     → backend/src/routes/vendor-portal.js
 *   payment rails          → backend/src/services/paymentLinks.js
 *
 * ── Block types understood by the renderer ───────────────────────────────────
 *   { type: "p",       text }                       paragraph
 *   { type: "where",   path: [...] }                "where to click" breadcrumb
 *   { type: "steps",   items: [{ t, d }] }          numbered steps
 *   { type: "bullets", items: ["…"] }               bullet list
 *   { type: "note",    tone, title, text }          callout (info|tip|warn|danger|success)
 *   { type: "table",   head: [...], rows: [[...]] } comparison table
 *   { type: "chips",   items: [{ label, tone, d }] }status reference
 *   { type: "faq",     items: [{ q, a }] }          question / answer
 *
 * Inline markup inside any text: **bold** and `code`.
 */

// ── Shared blocks ─────────────────────────────────────────────────────────────

const PORTAL_TABLE = {
  type: "table",
  head: ["Portal", "Who signs in", "What they do there"],
  rows: [
    ["Nexso Admin", "Nexso staff", "Onboard societies, verify vendors, assign tickets, oversee all societies"],
    ["Secretary", "One account per society (username `BLD-XXXXXX`)", "Residents, billing, collections, month closure, notices"],
    ["Resident", "Residents, by OTP on their WhatsApp number", "See bills, pay, raise complaints, visitor passes, polls"],
    ["Vendor", "Service partners", "Work the tickets assigned to them"],
    ["Guard", "Gate staff", "Verify visitor passes at the gate"],
  ],
};

const TICKET_STATUS_CHIPS = {
  type: "chips",
  items: [
    { label: "OPEN",        tone: "amber",  d: "Raised by a resident, nobody assigned yet" },
    { label: "ASSIGNED",    tone: "blue",   d: "A vendor has been given the job but hasn't started" },
    { label: "IN_PROGRESS", tone: "violet", d: "The vendor has started work" },
    { label: "RESOLVED",    tone: "green",  d: "The vendor says the job is done" },
    { label: "CLOSED",      tone: "slate",  d: "Signed off — the final state" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SECRETARY
// ─────────────────────────────────────────────────────────────────────────────

const SECRETARY_GUIDE = {
  title: "Secretary Guide",
  subtitle: "How maintenance, billing, collections and month closure work in Nexso.",
  sections: [
    {
      id: "overview",
      title: "Start here",
      icon: "Home",
      blocks: [
        {
          type: "p",
          text: "Nexso runs your society across connected portals. You sign in to the **Secretary portal**; your residents, your vendors and Nexso staff each see their own view of the same data. A complaint a resident sends on WhatsApp becomes a ticket you can see; a bill you generate appears in that resident's billing page within seconds.",
        },
        PORTAL_TABLE,
        {
          type: "p",
          text: "Your sidebar has ten screens. Most of your month happens in just two of them: **Maintenance** (billing and collections) and **Residents** (who gets billed, and how much).",
        },
        {
          type: "table",
          head: ["Screen", "Use it for"],
          rows: [
            ["Dashboard", "Live counts and the newest tickets"],
            ["Residents", "Add / edit residents, and set each unit's maintenance amount and due day"],
            ["Tickets", "Watch complaints raised by your residents (read-only)"],
            ["Announcements", "Notice-board posts residents see in their portal"],
            ["Events", "Society calendar entries"],
            ["Polls", "Ask residents to vote, see results"],
            ["Broadcast", "Send WhatsApp to everyone or one tower — including emergency alerts"],
            ["Finances", "The society's full expense ledger and Income & Expenditure statement"],
            ["Maintenance", "Expense sheet, bill generation, collections, month closure"],
            ["My Profile", "Change your password"],
          ],
        },
        {
          type: "note",
          tone: "tip",
          title: "The one thing to remember",
          text: "Maintenance is **monthly**. Everything — the expense sheet, the dues, the closure — is stamped with a month. The month picker at the top of the Maintenance screen decides which month you are looking at and acting on. Check it before you click anything.",
        },
      ],
    },

    {
      id: "cycle",
      title: "The monthly cycle",
      icon: "Sync",
      blocks: [
        {
          type: "p",
          text: "Every month follows the same five moves. Do them in order — each one depends on the one before it.",
        },
        {
          type: "steps",
          items: [
            { t: "Build the expense sheet", d: "Enter what the society spent this month. Nexso divides it across the units to get each flat's share." },
            { t: "Generate dues", d: "Creates one bill per unit — base maintenance plus that expense share — with a due date and a payment link." },
            { t: "Send reminders", d: "WhatsApp or email goes out to everyone who hasn't paid, with the payment link attached." },
            { t: "Record payments", d: "Online payments settle themselves. UPI and cash payments you confirm by hand once the money is in the bank." },
            { t: "Close the month", d: "Locks the books, freezes the numbers, and produces a closure PDF you can put in front of the committee." },
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Where all of this lives",
          text: "**Maintenance** in the sidebar has three tabs: **Dues Collection** (the bills and their status), **Expense Sheet** (what you spent), and **Account Tally** (month-by-month history).",
        },
      ],
    },

    {
      id: "setup",
      title: "One-time setup",
      icon: "Settings",
      blocks: [
        {
          type: "p",
          text: "Do this once, before your first billing month. If any of it is missing, bill generation will quietly produce nothing.",
        },
        { type: "where", path: ["My Profile", "Payment Settings"] },
        {
          type: "steps",
          items: [
            {
              t: "Set your society's UPI ID",
              d: "Press **Set up UPI ID** and enter it — it must look like `society@bank`. Nexso shows you the ID exactly as residents will see it and asks you to confirm before saving, because this is the account their money actually lands in. Optionally set a payee name; it defaults to your society name.",
            },
          ],
        },
        { type: "where", path: ["Maintenance", "top of the page"] },
        {
          type: "steps",
          items: [
            {
              t: "Turn on Maintenance Collection",
              d: "The toggle in the bar at the top. While it is OFF, no dues are generated, no reminders go out, and the Generate button stays disabled.",
            },
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Changing the UPI ID later",
          text: "The bar at the top of **Maintenance** shows which ID you are collecting into, with a **Change** button that opens the same confirm-before-saving dialog. It is printed on every bill and reminder, so a change only affects bills generated after it.",
        },
        { type: "where", path: ["Residents", "edit a resident", "Maintenance section"] },
        {
          type: "steps",
          items: [
            {
              t: "Switch maintenance on for each unit and set the numbers",
              d: "A unit with maintenance switched off is skipped entirely at bill time.",
            },
          ],
        },
        {
          type: "table",
          head: ["Field", "What it means"],
          rows: [
            ["Maintenance enabled", "Whether this unit is billed at all. Also decides how many units the expense sheet is divided by."],
            ["Monthly amount", "The unit's **base** maintenance. The expense-sheet share is added on top of this at bill time."],
            ["Due day of month", "Any day from the 1st to the 28th. The bill's due date is that day of the billing month."],
            ["Send bill / reminder to", "**Owner** or **Tenant**. Decides which resident of the unit receives the bill. If that person isn't on record, the other one is billed instead."],
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Count your units",
          text: "The expense sheet divides your total spend by the number of **maintenance-enabled** units — not by the number of flats in the building. Turn maintenance on for every unit that should share the costs before you build a sheet, or everyone else's share will be too high.",
        },
      ],
    },

    {
      id: "expense-sheet",
      title: "Step 1 — The expense sheet",
      icon: "Documentation",
      blocks: [
        { type: "where", path: ["Maintenance", "Expense Sheet tab"] },
        {
          type: "p",
          text: "The expense sheet answers one question: **what did the society spend this month, and what is each flat's share of it?** You enter society-wide totals; Nexso does the division.",
        },
        {
          type: "table",
          head: ["Part of the sheet", "What goes in it"],
          rows: [
            ["Fixed Maintenance Fees", "Costs that barely move month to month — sinking fund, insurance, security, housekeeping, lift AMC, management fee"],
            ["Variable Maintenance Fees", "Costs that swing — common-area electricity, generator fuel, garbage collection, tank cleaning"],
            ["Interest rate on arrears", "Yearly rate used for the interest line on an arrears invoice. Defaults to 21% p.a."],
          ],
        },
        {
          type: "steps",
          items: [
            { t: "Pick the month", d: "Use the month picker at the top. The sheet belongs to that month alone." },
            { t: "Type the total society amount for each line", d: "Not the per-flat amount — the whole society's bill for that item. The Per Unit column fills in as you type." },
            { t: "Add or remove lines", d: "Use **+ Add Item** for anything the default list doesn't cover. The default rows can be left at zero; rows you added can be deleted with the ✕." },
            { t: "Check the summary", d: "The box at the bottom shows fixed per unit, variable per unit, and the total each flat will carry." },
            { t: "Preview a real bill", d: "**Preview Bill** → pick a resident → see their exact invoice, including arrears and interest, before anyone else sees it." },
            { t: "Save Expense Sheet", d: "Nothing is billed yet. Saving simply stores the breakdown that the next Generate Dues run will use." },
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Saving the sheet does not change bills you already generated",
          text: "Dues freeze the breakdown at the moment they are created. If you edit the sheet after generating, existing bills keep the old figures. Finish the sheet **first**, then generate.",
        },
        {
          type: "note",
          tone: "info",
          title: "Every month starts blank",
          text: "The sheet is per month, so a new month opens with the default rows at zero rather than last month's figures. Keep last month open in another tab if you want to copy across.",
        },
      ],
    },

    {
      id: "generate",
      title: "Step 2 — Generating bills",
      icon: "Refresh",
      blocks: [
        { type: "where", path: ["Maintenance", "Dues Collection tab", "Generate Dues"] },
        {
          type: "p",
          text: "**Generate Dues** creates one bill for every maintenance-enabled unit in the selected month. Here is exactly what it builds:",
        },
        {
          type: "table",
          head: ["On the bill", "Where it comes from"],
          rows: [
            ["Amount", "The unit's base monthly amount **+** its share of the saved expense sheet"],
            ["Billed to", "The Owner or Tenant of that unit, per the unit's *Send bill to* setting — falling back to whoever else is on record"],
            ["Due date", "The unit's due day, in the selected month"],
            ["Status", "Pending"],
            ["Payment link", "Minted automatically when a payment rail is configured, and reused in every reminder, email and PDF"],
          ],
        },
        {
          type: "note",
          tone: "success",
          title: "Safe to press twice",
          text: "A unit can only ever have one bill per month. Re-running Generate creates the missing ones and reports the rest as *already existed* — it never double-bills anyone.",
        },
        {
          type: "note",
          tone: "warn",
          title: "Bills raised automatically on the 1st carry the base amount only",
          text: "Nexso auto-generates dues at 08:00 on the 1st of each month for every society with maintenance switched on — but that automatic run bills the **base amount alone**, with no expense-sheet share. Because a unit can only hold one bill per month, a later manual Generate cannot correct it. If you bill by expense sheet, build the sheet and press **Generate Dues** yourself before the 1st.",
        },
        {
          type: "note",
          tone: "info",
          title: "If nothing is created",
          text: "Generate produces nothing when maintenance collection is off, when the month is closed, or when no unit has an amount **and** a due day saved against it.",
        },
      ],
    },

    {
      id: "reminders",
      title: "Step 3 — Reminders",
      icon: "Send",
      blocks: [
        { type: "where", path: ["Maintenance", "Dues Collection tab", "Send Reminders"] },
        {
          type: "p",
          text: "A reminder goes out by **email** where the resident has an email address, and by **WhatsApp** otherwise. Both carry the amount, the due date, the UPI ID and the tappable payment link.",
        },
        {
          type: "p",
          text: "A due only qualifies for a reminder when all three are true:",
        },
        {
          type: "bullets",
          items: [
            "It is still **Pending** — paid, waived and awaiting-verification dues are left alone",
            "The due date is **within 7 days** (or already past)",
            "No reminder has been sent for it before",
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "One reminder per bill",
          text: "Once a due has been reminded, pressing the button again skips it — that is why you may see *No reminders due yet*. It is not an error; it means nobody in this month currently qualifies.",
        },
        {
          type: "p",
          text: "You rarely need to press the button at all — Nexso runs the whole chase automatically every day:",
        },
        {
          type: "table",
          head: ["Time (IST)", "What runs"],
          rows: [
            ["1st, 08:00", "Dues generated for every society with maintenance on (base amount only)"],
            ["Daily, 09:00", "Reminders sent for dues falling due within 7 days"],
            ["Daily, 09:05", "Any Pending due whose date has passed is flipped to **Overdue**"],
            ["Daily, 09:10", "A one-time overdue notice goes out on WhatsApp"],
          ],
        },
        {
          type: "note",
          tone: "tip",
          title: "Awaiting-verification dues are protected",
          text: "A resident who has declared a payment and is waiting on you is **never** marked overdue by the daily sweep. Only Pending dues are.",
        },
      ],
    },

    {
      id: "mark-paid",
      title: "Step 4 — Recording payments",
      icon: "PaymentCard",
      blocks: [
        { type: "where", path: ["Maintenance", "Dues Collection tab", "Action column"] },
        {
          type: "p",
          text: "Money reaches the society by three routes, and each is recorded differently.",
        },
        {
          type: "table",
          head: ["How they paid", "What you do"],
          rows: [
            ["Paid through the online payment link (gateway)", "**Nothing.** The gateway tells Nexso, and the due flips to Paid on its own."],
            ["Paid by UPI to the society's ID", "The resident types their UTR on the pay page and the due becomes **To verify**. You confirm it against the bank statement."],
            ["Cash, cheque or a direct bank transfer", "Type the reference in the *Ref / UTR* box and press **Mark Paid**."],
          ],
        },
        {
          type: "p",
          text: "**Confirming a UPI payment.** A due sitting at *To verify* shows the UTR the resident declared and when they declared it, with two buttons:",
        },
        {
          type: "bullets",
          items: [
            "**Confirm received** — marks it Paid, stores the UTR as the payment reference, and WhatsApps the resident a confirmation.",
            "**Not found** — asks you for a reason, sends the due back to Pending, writes the reason into the due's notes, and tells the resident what happened so they can sort it out.",
          ],
        },
        {
          type: "note",
          tone: "danger",
          title: "Check the bank before you confirm",
          text: "A UTR typed by a resident is a claim, not proof. Confirming marks society money as received and feeds straight into the month's collection total. Match it against the statement first.",
        },
        {
          type: "p",
          text: "**The other two buttons.**",
        },
        {
          type: "bullets",
          items: [
            "**Waive** — writes off the bill for a resident who genuinely shouldn't pay this month. Waived amounts are tracked separately from collected ones.",
            "**Undo** — on a paid or waived due, puts it back to Pending. Use it when you clicked the wrong row.",
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Pay Link and copy",
          text: "Every unpaid due shows a **Pay Link** you can open, and a copy button. Handy when a resident says they never got the message — copy it and paste it straight into a chat.",
        },
      ],
    },

    {
      id: "closure",
      title: "Step 5 — Closing the month",
      icon: "Lock",
      blocks: [
        { type: "where", path: ["Maintenance", "Dues Collection tab", "Close Month"] },
        {
          type: "p",
          text: "Closing is your formal sign-off: it says *these are the final numbers for this month*. It is what turns a working spreadsheet into a record you can hand to the committee or the auditor.",
        },
        {
          type: "p",
          text: "**What closing actually does**",
        },
        {
          type: "bullets",
          items: [
            "Every remaining **Pending** due is flipped to **Overdue**",
            "The month is **locked** — no due can be marked paid, waived, undone, confirmed or rejected, and no new dues can be generated for it",
            "The totals are frozen: billed, collected, waived, overdue, total expenses, and the resulting **surplus or deficit**",
            "Your name, the time, and any note you typed are stored against the closure",
            "A **closure summary PDF** becomes downloadable",
          ],
        },
        {
          type: "p",
          text: "**Before you close, work through this list**",
        },
        {
          type: "steps",
          items: [
            { t: "Clear the To verify queue", d: "Anything still awaiting verification cannot be confirmed after closing without reopening the month. The close dialog warns you and tells you how many are outstanding." },
            { t: "Record cash and cheque payments", d: "Anything collected off-platform needs to be marked paid, or the collection total will understate what you actually took in." },
            { t: "Finish the expense sheet", d: "The closing surplus/deficit is collections minus the expense-sheet total. An incomplete sheet makes the month look better than it was." },
            { t: "Read the two summary boxes", d: "The dialog shows collected against pending/overdue. If those numbers surprise you, stop and investigate before closing." },
            { t: "Add a note", d: "Optional, and worth it — 'water pump repair deferred to next month' is exactly the sort of thing nobody remembers a year later." },
          ],
        },
        {
          type: "p",
          text: "**Reopening.** A closed month can be reopened, and it is not a big deal — but it is deliberately visible. You must type a reason, which is stored with your name and the time as an audit trail. Reopening unlocks editing again; close it a second time when you're done and the totals recompute from scratch.",
        },
        {
          type: "note",
          tone: "warn",
          title: "Closing doesn't chase arrears for you",
          text: "Unpaid dues stay on the month they belong to, now marked Overdue. They are not folded into next month's bill. To chase them, point the month picker at the old month and filter by **Overdue** — that list is your arrears register.",
        },
      ],
    },

    {
      id: "arrears",
      title: "Overdue, arrears and interest",
      icon: "Warning",
      blocks: [
        {
          type: "p",
          text: "A due becomes **Overdue** in one of two ways: the daily 09:05 sweep catches it after its due date passes, or you close the month while it is still pending.",
        },
        {
          type: "p",
          text: "The resident gets one automatic overdue notice on WhatsApp with the payment link, and then it is over to you — polite pressure is not automated.",
        },
        {
          type: "p",
          text: "**Interest.** The rate on the expense sheet (21% a year by default) drives the *Interest on Due* line you see on the **Preview Bill** screen and on an arrears invoice: last month's unpaid total, multiplied by the annual rate, divided by twelve.",
        },
        {
          type: "note",
          tone: "info",
          title: "How to read the numbers honestly",
          text: "The amount Nexso generates for a new month is **base + expense share**. Old unpaid dues stay on their own month rather than being added into the new bill, so a resident with arrears has two open dues, not one bigger one. Collect them as two.",
        },
        {
          type: "p",
          text: "**Finding your arrears.** Set the month picker to a past month and set the filter to **Overdue**. Repeat for each month you want to chase. The **Account Tally** tab gives you the same thing at a glance — one row per month, with what was billed against what was collected.",
        },
      ],
    },

    {
      id: "reports",
      title: "Reports & PDFs",
      icon: "PDF",
      blocks: [
        {
          type: "table",
          head: ["Document", "Where", "What it is for"],
          rows: [
            ["Unit invoice", "PDF button on any due row", "One resident's bill, with the full item-by-item breakdown and an invoice number. Send it when someone asks what they're paying for."],
            ["Collection register", "**Register PDF** button, Dues Collection tab", "The whole month on one sheet — every unit, amount, status — plus totals. The document to bring to a committee meeting."],
            ["Closure summary", "The closed-month banner, or the Account Tally rows", "The signed-off month: billed, collected, waived, overdue, expenses, surplus/deficit, who closed it and when."],
            ["Account tally", "**Account Tally** tab", "A year at a glance, month by month, with running totals. Not a PDF — read it on screen."],
          ],
        },
        {
          type: "note",
          tone: "tip",
          title: "Preview before you send",
          text: "The **Preview Bill** button on the Expense Sheet tab renders any resident's invoice on screen, and prints. Use it to sanity-check a month's figures before a single resident sees them.",
        },
      ],
    },

    {
      id: "residents",
      title: "Residents",
      icon: "Group",
      blocks: [
        { type: "where", path: ["Residents"] },
        {
          type: "p",
          text: "This screen is the source of truth for who lives where — and, through the maintenance fields, for who gets billed what. Bill generation reads it directly, so it is worth keeping tidy.",
        },
        {
          type: "bullets",
          items: [
            "**Adding a resident** attaches them to a unit as an Owner or a Tenant.",
            "**A unit can hold both.** The unit's *Send bill to* setting decides which of them receives the maintenance bill.",
            "**The phone number is the login.** Residents sign in to their own portal with a one-time password sent to the WhatsApp number on their record — so a wrong number means no login, no reminders and no bill.",
            "**Removing a resident** stops future bills. It does not erase the bills they already have.",
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "What the resident sees",
          text: "Their portal shows their bills with the full breakdown, a pay button, their complaints, announcements, events, polls and visitor passes. Anything you post reaches them there as well as on WhatsApp.",
        },
      ],
    },

    {
      id: "tickets",
      title: "Service tickets",
      icon: "Ticket",
      blocks: [
        { type: "where", path: ["Tickets"] },
        {
          type: "p",
          text: "When a resident messages a complaint on WhatsApp, Nexso turns it into a ticket automatically and it appears on this screen. Your view is **read-only** — you can watch and filter, but assignment is handled by Nexso staff, who route the job to a verified vendor in the right trade.",
        },
        TICKET_STATUS_CHIPS,
        {
          type: "table",
          head: ["Who", "What they do to a ticket"],
          rows: [
            ["Resident", "Raises it on WhatsApp, and is notified automatically at every step"],
            ["Nexso Admin", "Assigns a vendor, and closes the ticket at the end"],
            ["Vendor", "Moves it Assigned → In Progress → Resolved from their own portal"],
            ["You", "Watch it, and chase whoever has gone quiet"],
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Stale tickets escalate themselves",
          text: "A ticket left **Open** on Normal priority for more than 24 hours is automatically raised to **High**, with a line written into its history. If you see a lot of High-priority tickets, work is not being assigned quickly enough.",
        },
      ],
    },

    {
      id: "communication",
      title: "Announcements, events, polls & broadcast",
      icon: "Megaphone",
      blocks: [
        {
          type: "table",
          head: ["Tool", "Reaches residents", "Best for"],
          rows: [
            ["Announcements", "In the resident portal's notice board", "Water shut-off, lift servicing, AGM notices. Can be pinned and given a priority."],
            ["Events", "The resident portal's calendar", "Diwali celebration, general body meeting, deep-clean day"],
            ["Polls", "The resident portal, with live results for you", "Deciding things without a physical meeting"],
            ["Broadcast", "WhatsApp, to everyone or to one tower", "Something that genuinely needs to interrupt people"],
            ["Emergency Alert", "WhatsApp, to everyone, marked urgent", "Fire, flood, gas leak, security incident"],
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Broadcast lands in people's pockets",
          text: "Broadcasts and emergency alerts go straight to residents' phones and cannot be recalled. Use the **preview** on the Broadcast screen to check exactly who will receive it before you send. Anything that can wait belongs on the notice board instead.",
        },
      ],
    },

    {
      id: "finances",
      title: "Finances vs the Expense Sheet",
      icon: "Money",
      blocks: [
        {
          type: "p",
          text: "Two different screens deal with money going out, and mixing them up is the single most common confusion in the portal.",
        },
        {
          type: "table",
          head: ["", "Maintenance → Expense Sheet", "Finances"],
          rows: [
            ["Question it answers", "What do we charge each flat this month?", "What did the society actually spend, on what?"],
            ["Granularity", "A dozen summary lines for one month", "Every individual bill, dated, categorised, with payment mode"],
            ["Effect", "Feeds directly into the bills you generate", "Feeds the Income & Expenditure statement and the annual report"],
            ["Who reads it", "Residents, as the breakdown on their invoice", "The committee and the auditor"],
          ],
        },
        {
          type: "p",
          text: "**Finances** keeps the society's real ledger: expenses under proper heads (salaries, utilities, repairs, AMCs, insurance, legal, events, sinking fund, capital expenditure), other income (parking, hall bookings, NOC fees, FD interest), an Income & Expenditure statement, and an annual report. It uses cooperative-society accounting language throughout — **surplus and deficit**, not profit and loss.",
        },
        {
          type: "note",
          tone: "tip",
          title: "Keep both, and keep them consistent",
          text: "Log real bills in Finances as they arrive through the month. When you build the expense sheet, the totals should recognisably match what the ledger says you spent.",
        },
      ],
    },

    {
      id: "reference",
      title: "Status reference",
      icon: "BulletedList",
      blocks: [
        { type: "p", text: "**Maintenance due statuses**" },
        {
          type: "chips",
          items: [
            { label: "Pending",   tone: "amber",  d: "Billed, not yet paid, not yet past its due date" },
            { label: "To verify", tone: "violet", d: "The resident declared a UPI payment — waiting for you to confirm it against the bank. Never auto-marked overdue." },
            { label: "Paid",      tone: "green",  d: "Money received. Counts towards the month's collections." },
            { label: "Overdue",   tone: "red",    d: "Past its due date, or caught by a month closure. Still collectable." },
            { label: "Waived",    tone: "slate",  d: "Written off deliberately. Tracked apart from collections." },
          ],
        },
        { type: "p", text: "**Month statuses**" },
        {
          type: "chips",
          items: [
            { label: "Open",   tone: "blue",  d: "Normal working state — dues can be generated and edited" },
            { label: "Closed", tone: "slate", d: "Signed off and locked. Reopen (with a reason) to make changes." },
          ],
        },
        { type: "p", text: "**Ticket statuses**" },
        TICKET_STATUS_CHIPS,
      ],
    },

    {
      id: "faq",
      title: "When something looks wrong",
      icon: "Help",
      blocks: [
        {
          type: "faq",
          items: [
            {
              q: "I pressed Generate Dues and nothing happened",
              a: "Three usual causes. Maintenance collection is switched off at the top of the page; the month is closed (the banner will say so); or no unit has both an amount and a due day saved on the Residents screen. Check them in that order.",
            },
            {
              q: "It says 0 created and 40 skipped",
              a: "Those 40 units already have a bill for this month, so nothing was double-billed. Check the month picker — you may be looking at a month you already generated.",
            },
            {
              q: "Send Reminders says 'No reminders due yet'",
              a: "Nobody currently qualifies. Reminders only go to Pending dues that are within 7 days of their due date and have not been reminded before. Early in the month, that is often nobody.",
            },
            {
              q: "I can't mark anything paid — the buttons do nothing",
              a: "The month is closed. Look for the lock banner above the table. Press **Reopen to make changes**, give a reason, do what you need, and close it again.",
            },
            {
              q: "A resident insists they paid but their due still shows Pending",
              a: "Filter by **Awaiting verification** first — if they paid by UPI and declared a UTR, it is waiting on you. If it isn't there, they may have paid without declaring anything; find it in the bank statement and record it manually with **Mark Paid** and the reference.",
            },
            {
              q: "The amount on a bill is wrong",
              a: "A bill's amount is fixed once generated, and a unit can only hold one bill per month, so regenerating won't fix it. For a small difference, record the correct payment with a note explaining it. For a real error, reach out to Nexso support to have the due removed so it can be regenerated cleanly.",
            },
            {
              q: "I closed the month too early",
              a: "Reopen it. Press **Reopen Month**, type the reason, make your corrections, and close again — the totals are recomputed from scratch on the second closure. The reopening is logged, which is the point.",
            },
            {
              q: "Residents aren't receiving anything",
              a: "Almost always a contact-details problem. Open the resident on the Residents screen and check the WhatsApp number and email. The same number is their login, so a resident who can't sign in usually can't be messaged either.",
            },
          ],
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR
// ─────────────────────────────────────────────────────────────────────────────

const VENDOR_GUIDE = {
  title: "Vendor Guide",
  subtitle: "How jobs reach you, and how to work them through to done.",
  sections: [
    {
      id: "overview",
      title: "Start here",
      icon: "Home",
      blocks: [
        {
          type: "p",
          text: "Nexso is how the societies you serve send you work. A resident reports a problem, the society routes it to a vendor in the right trade, and if that's you, it lands in **My Tickets**. Your whole job in this portal is to keep those tickets honest: start them when you start, resolve them when they're done.",
        },
        {
          type: "table",
          head: ["Screen", "What it shows"],
          rows: [
            ["Dashboard", "How many tickets are waiting, in progress, resolved and closed"],
            ["My Tickets", "Every job assigned to you, with the resident's contact and location"],
            ["My Profile", "Your business details, trades and verification status"],
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "You only ever see your own work",
          text: "Tickets assigned to other vendors are invisible to you, and so is everything else about the society. Resident contact details appear only on jobs that are yours.",
        },
      ],
    },

    {
      id: "login",
      title: "Signing in",
      icon: "Signin",
      blocks: [
        {
          type: "p",
          text: "Your username and first password come from Nexso when your business is registered. On your **first sign-in you must set your own password** before you can go any further — that is normal, not an error.",
        },
        {
          type: "bullets",
          items: [
            "Sign in at the Vendor Portal login (the **Vendor Portal** link at the bottom of the main sign-in screen).",
            "Change your password later from **My Profile** whenever you want.",
            "Forgotten it? Nexso support has to reset it — there is no self-service reset.",
          ],
        },
      ],
    },

    {
      id: "verification",
      title: "Verification status",
      icon: "Certificate",
      blocks: [
        {
          type: "p",
          text: "Before work is routed to you, Nexso verifies your business — your documents, trades and contact details. Your current status is on **My Profile**.",
        },
        {
          type: "chips",
          items: [
            { label: "VERIFICATION_PENDING", tone: "amber", d: "Under review. You can sign in, but jobs generally won't be routed to you yet." },
            { label: "APPROVED",             tone: "green", d: "Verified and in the pool — tickets in your trades can be assigned to you." },
            { label: "REJECTED",             tone: "red",   d: "Verification was declined, with a reason. Contact Nexso to sort it out." },
            { label: "SUSPENDED",            tone: "slate", d: "Temporarily paused, with a reason on record. No new work until it's lifted." },
          ],
        },
        {
          type: "note",
          tone: "tip",
          title: "Keep your trades accurate",
          text: "Work is routed by category — electrical, plumbing, lift maintenance and so on. If your listed trades are wrong or incomplete, you'll be sent jobs you can't do and miss the ones you can.",
        },
      ],
    },

    {
      id: "how-work-arrives",
      title: "How work reaches you",
      icon: "Ticket",
      blocks: [
        {
          type: "steps",
          items: [
            { t: "A resident reports a problem", d: "Usually by WhatsApp to their society. It becomes a ticket with a category, a description and a priority." },
            { t: "The society assigns it to you", d: "Based on your trades. The ticket moves to **Assigned** and is yours." },
            { t: "You're notified", d: "The bell in the header shows a count, refreshed every 30 seconds, and **My Tickets** in the sidebar carries the same number. Tapping the bell opens your new jobs." },
            { t: "The resident is told too", d: "They get a WhatsApp saying your business has been assigned and will attend shortly. That message sets their expectations — and starts your clock." },
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Assigned means someone is waiting",
          text: "The resident has already been told you're coming. If you can't take a job, tell the society quickly rather than leaving it sitting at Assigned — the portal has no decline button.",
        },
      ],
    },

    {
      id: "working",
      title: "Working a ticket",
      icon: "Build",
      blocks: [
        { type: "where", path: ["My Tickets", "click any row"] },
        {
          type: "p",
          text: "Tickets move in one direction only, one step at a time. The portal shows exactly one button, and it is always the right next step:",
        },
        {
          type: "steps",
          items: [
            { t: "Assigned → press ▶ Start Work", d: "Do this when you actually begin — travelling to site counts. The ticket becomes **In Progress** and the resident is told you've started." },
            { t: "In Progress → press ✓ Mark Resolved", d: "Do this when the job is genuinely finished. The ticket becomes **Resolved** and the resident is told, with an invitation to come back if the problem returns." },
            { t: "Closed", d: "The society signs the job off. You don't do this, and nothing more is needed from you." },
          ],
        },
        {
          type: "p",
          text: "You can act straight from the list using the button on the right of each row, or open the ticket first to see the detail panel — which is usually the better move, because it carries everything you need for the visit:",
        },
        {
          type: "bullets",
          items: [
            "**Category and priority** — what kind of job it is and how urgent",
            "**Description** — the resident's own words about the problem",
            "**Society, tower, floor and unit** — exactly where to go",
            "**Resident name and WhatsApp** — tap the number to open a chat and confirm a time",
            "**Created and last updated** — how long this has been waiting",
          ],
        },
        {
          type: "note",
          tone: "danger",
          title: "You can't undo a step",
          text: "There is no way back from Resolved. If you resolve a ticket by mistake, or the fault returns after you've closed it out, contact the society — they can reopen or raise a fresh ticket. Don't guess.",
        },
      ],
    },

    {
      id: "resident-view",
      title: "What the resident is told",
      icon: "Message",
      blocks: [
        {
          type: "p",
          text: "Every button you press sends the resident a WhatsApp message automatically. This is why status accuracy matters — the buttons are how you talk to the customer.",
        },
        {
          type: "table",
          head: ["You press", "They receive"],
          rows: [
            ["(assignment)", "\"Your complaint has been assigned to <your business>. They will attend to it shortly.\""],
            ["Start Work", "\"<your business> has started working on it. We'll notify you once it's resolved.\""],
            ["Mark Resolved", "\"Your complaint has been marked as resolved by <your business>. If the issue persists, just message us again.\""],
          ],
        },
        {
          type: "note",
          tone: "tip",
          title: "Don't mark work resolved early",
          text: "Marking a job resolved tells the resident it's finished. Doing that before it is turns a small delay into a complaint about you.",
        },
      ],
    },

    {
      id: "priority",
      title: "Priority",
      icon: "Warning",
      blocks: [
        {
          type: "chips",
          items: [
            { label: "URGENT", tone: "red",   d: "Safety or a total failure — attend immediately" },
            { label: "HIGH",   tone: "amber", d: "Attend today" },
            { label: "NORMAL", tone: "blue",  d: "Routine — schedule it in" },
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Priority can rise on its own",
          text: "A ticket left unattended for more than 24 hours is automatically escalated from Normal to High. A ticket that has changed priority since you first saw it hasn't been re-raised — it has been waiting.",
        },
      ],
    },

    {
      id: "reference",
      title: "Status reference",
      icon: "BulletedList",
      blocks: [
        TICKET_STATUS_CHIPS,
        {
          type: "table",
          head: ["Status", "Your next action"],
          rows: [
            ["ASSIGNED", "Press **Start Work** when you begin"],
            ["IN_PROGRESS", "Press **Mark Resolved** when the job is done"],
            ["RESOLVED", "Nothing — waiting on the society to close it"],
            ["CLOSED", "Nothing — finished"],
          ],
        },
      ],
    },

    {
      id: "faq",
      title: "When something looks wrong",
      icon: "Help",
      blocks: [
        {
          type: "faq",
          items: [
            {
              q: "There's no button on a ticket",
              a: "It's already Resolved or Closed, so there's nothing left for you to do. The panel says so at the bottom.",
            },
            {
              q: "A ticket vanished from my Assigned list",
              a: "It moved on — check the **In Progress** filter. Tickets sort by status, so anything you've started drops below the new work.",
            },
            {
              q: "It says the ticket was updated elsewhere",
              a: "Someone else moved it, or a double tap registered twice. Refresh the list and look at the current status before acting again.",
            },
            {
              q: "I was assigned something outside my trade",
              a: "Contact the society through the ticket's resident contact or your Nexso contact. Don't start work on it — leaving it Assigned keeps it visible as unhandled.",
            },
            {
              q: "The resident isn't answering",
              a: "Tap the WhatsApp number in the detail panel — it opens a chat directly. If you still can't reach them, leave the ticket In Progress and tell the society; don't mark it resolved.",
            },
            {
              q: "I can't see the resident's number",
              a: "The society has no WhatsApp number on record for them. Ask the society office for a contact.",
            },
          ],
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEXSO ADMIN
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_GUIDE = {
  title: "Admin Guide",
  subtitle: "Onboarding societies, verifying vendors, routing tickets and overseeing collections.",
  sections: [
    {
      id: "overview",
      title: "Start here",
      icon: "Home",
      blocks: [
        {
          type: "p",
          text: "You are on the **Nexso Admin** portal — the only view that spans every society on the platform. Your work sits at the two points where Nexso touches the outside world: **bringing a society on board**, and **routing residents' problems to a vendor who can fix them**.",
        },
        PORTAL_TABLE,
        {
          type: "table",
          head: ["Screen", "Use it for"],
          rows: [
            ["Incident Dashboard", "Every ticket on the platform — assign vendors and move statuses"],
            ["Onboarding", "Register a society and walk it through the three setup steps"],
            ["Users", "Everyone known to the platform through WhatsApp"],
            ["Complaints", "The ticket list with filters, for digging rather than acting"],
            ["Vendors", "Register vendors, run the verification queue, approve / reject / suspend"],
            ["Payments", "Placeholder — no gateway console is wired in yet"],
            ["Maintenance", "Dues across all societies, with the same tools the secretary has"],
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Which login screen you land on",
          text: "The sign-in page follows the URL: `/admin` shows the admin login, a `/vendor…` path shows the vendor login, and anything else shows the combined Resident / Secretary login. The Guard portal is separate again, at `/guard`.",
        },
      ],
    },

    {
      id: "onboarding",
      title: "Onboarding a society",
      icon: "Add",
      blocks: [
        { type: "where", path: ["Onboarding", "New Society"] },
        {
          type: "p",
          text: "A three-step wizard, resumable at any point — the society's progress is saved after each step, so you can leave and come back.",
        },
        {
          type: "steps",
          items: [
            {
              t: "Building details",
              d: "Name, address, type (apartment, gated community, commercial, mixed use) and the committee contact. Saving this step creates the society **and its secretary login**.",
            },
            {
              t: "Unit structure",
              d: "Towers, floors per tower, and units per floor. Nexso generates standard unit numbers (floor 1 → 101, 102…), which you can adjust. Get this right — bills, tickets and visitor passes all hang off units.",
            },
            {
              t: "Residents",
              d: "Import from the downloadable spreadsheet template, or add them one at a time. The sheet carries name, type (owner/tenant), contact, BHK, and the maintenance fields (enabled, amount, due day).",
            },
          ],
        },
        {
          type: "note",
          tone: "danger",
          title: "The secretary password is shown exactly once",
          text: "Creating the society mints a secretary account with the username `BLD-XXXXXX` and a temporary password, displayed on screen at that moment and never again. Copy it and hand it over before you navigate away. The secretary is forced to change it on first sign-in. If it's lost, use **Reset secretary password** on the society's detail page.",
        },
        {
          type: "p",
          text: "**After the wizard.** On the society's detail page you can add or edit residents, adjust the structure, create the **guard account** for the gate, and reset the secretary's password.",
        },
        {
          type: "note",
          tone: "tip",
          title: "Hand over cleanly",
          text: "A society is only really live when the secretary has signed in, switched maintenance collection on, saved a UPI ID, and set an amount and due day against the units. Walk them through it — that is the checklist in their own Guide, under **One-time setup**.",
        },
      ],
    },

    {
      id: "tickets",
      title: "Tickets: intake and routing",
      icon: "Ticket",
      blocks: [
        { type: "where", path: ["Incident Dashboard"] },
        {
          type: "p",
          text: "Residents report problems on WhatsApp. The webhook reads the message, works out what it is about, and creates a ticket against the right society and resident. From there it needs a human — you — to put it in front of a vendor.",
        },
        {
          type: "steps",
          items: [
            { t: "Read the new Open tickets", d: "The sidebar count covers Open plus Assigned, refreshed every 30 seconds." },
            { t: "Assign a vendor", d: "Pick one whose trades match the category. The ticket moves to **Assigned**." },
            { t: "Let the vendor work", d: "They move it to In Progress and then Resolved from their own portal. Every move messages the resident automatically." },
            { t: "Close it", d: "Once the resident is satisfied, close the ticket. That is the final state, and yours to set." },
          ],
        },
        TICKET_STATUS_CHIPS,
        {
          type: "note",
          tone: "info",
          title: "Two things happen on assignment",
          text: "The vendor is notified on WhatsApp and their portal bell lights up; the resident is told which business is coming. Assigning to the wrong vendor therefore misinforms the resident too — check the trade before you save.",
        },
        {
          type: "note",
          tone: "warn",
          title: "Escalation is a signal about you, not the vendor",
          text: "Every hour, any ticket still **Open** on Normal priority after 24 hours is bumped to **High** and a line is written into its history. Open tickets have not been assigned yet — a pile of auto-escalated tickets means routing is running late.",
        },
      ],
    },

    {
      id: "vendors",
      title: "Vendors and verification",
      icon: "Shop",
      blocks: [
        { type: "where", path: ["Vendors"] },
        {
          type: "p",
          text: "Only verified vendors should be receiving work. Registration and verification are two separate steps, deliberately.",
        },
        {
          type: "steps",
          items: [
            {
              t: "Register the vendor",
              d: "Business and owner name, phone, email, WhatsApp, GST, team size, emergency availability, and their **trades**. Every new vendor starts at *Verification pending*.",
            },
            {
              t: "Create their portal login (optional, at registration)",
              d: "Set a username and a password of at least six characters and hand them over. The vendor must change the password on first sign-in. Skip this and the vendor has a record but no portal access.",
            },
            {
              t: "Check their documents",
              d: "The vendor's detail view lists everything uploaded against them.",
            },
            {
              t: "Approve or reject",
              d: "**Verification Queue** holds everyone still pending. Approving puts them in the routing pool; rejecting requires a reason, which is kept on the record.",
            },
          ],
        },
        {
          type: "chips",
          items: [
            { label: "VERIFICATION_PENDING", tone: "amber", d: "Registered, not yet checked" },
            { label: "APPROVED",             tone: "green", d: "Verified — eligible for assignment" },
            { label: "REJECTED",             tone: "red",   d: "Declined, with a reason stored" },
            { label: "SUSPENDED",            tone: "slate", d: "Paused, with a reason and a suspension history" },
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Suspend rather than delete",
          text: "Suspension is reversible and keeps the vendor's ticket history intact, which is what you want when a complaint is being investigated. Deleting throws away the record you may need.",
        },
        {
          type: "note",
          tone: "info",
          title: "Trades are the routing key",
          text: "Categories are a fixed list shared by the frontend and the API — electricians, plumbers, housekeeping, pest control, carpenters, CCTV, appliance repair, lift maintenance, security agencies, painting, tank cleaning, AC servicing, generator maintenance. A vendor with no trades set can't sensibly be routed anything.",
        },
      ],
    },

    {
      id: "maintenance",
      title: "Maintenance across societies",
      icon: "Money",
      blocks: [
        { type: "where", path: ["Maintenance"] },
        {
          type: "p",
          text: "The same collection tools the secretary has, but spanning every society — useful for support calls and for societies that haven't taken over their own billing yet.",
        },
        {
          type: "bullets",
          items: [
            "Filter dues by society, month and status",
            "Generate dues for a society and month",
            "Send reminders",
            "Mark a due paid or waived",
            "Switch maintenance collection on or off for a society, and set its UPI ID",
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Prefer to talk the secretary through it",
          text: "Acting on a society's dues from here is invisible to them and easy to misread later. Reserve it for genuine support cases, and tell them what you changed. Note that the admin view does not have the expense sheet, month closure or the arrears tooling — those are the secretary's, and are the right place for anything routine.",
        },
        {
          type: "p",
          text: "For the full billing model — expense sheet, generation, verification, closure — read the **Secretary Guide**; the mechanics are identical and worth knowing before you take a support call about them.",
        },
      ],
    },

    {
      id: "payment-rails",
      title: "Payment rails",
      icon: "PaymentCard",
      blocks: [
        {
          type: "p",
          text: "Every due gets a payment link when a rail is configured, and that one link is reused everywhere — WhatsApp reminders, emails and the bill PDF. The two rails differ only in how the money is reconciled.",
        },
        {
          type: "table",
          head: ["", "Razorpay", "UPI"],
          rows: [
            ["Setup for the society", "Gateway onboarding and KYC", "Nothing beyond a society UPI ID"],
            ["Resident pays", "Through the gateway's page", "By UPI, then declares the UTR on the pay page"],
            ["Becoming Paid", "Automatic — the gateway calls back", "The secretary confirms it against the bank statement"],
            ["Intermediate status", "None", "**To verify**, until the secretary confirms"],
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "Why the UPI rail needs a human",
          text: "A plain VPA gives no webhook and doesn't reliably echo back the reference Nexso sets, so there is no way to match a payment automatically. That's what the verification step exists for — it is not an oversight.",
        },
        {
          type: "note",
          tone: "warn",
          title: "The pay page needs a public URL",
          text: "The resident-facing pay page and the bill PDFs are served from the backend's public address. If it isn't configured, links and PDFs won't resolve for residents — worth checking first when a society reports dead payment links.",
        },
      ],
    },

    {
      id: "automation",
      title: "What runs on its own",
      icon: "Clock",
      blocks: [
        {
          type: "table",
          head: ["When (IST)", "What happens"],
          rows: [
            ["1st of the month, 08:00", "Dues generated for every society with maintenance enabled — **base amount only**, with no expense-sheet share"],
            ["Daily, 09:00", "Reminders for dues falling due within 7 days that haven't been reminded before"],
            ["Daily, 09:05", "Pending dues past their due date flip to Overdue"],
            ["Daily, 09:10", "A one-time overdue notice goes out on WhatsApp"],
            ["Hourly", "Tickets Open on Normal priority for over 24 hours escalate to High"],
          ],
        },
        {
          type: "note",
          tone: "warn",
          title: "Tell secretaries about the 1st",
          text: "The automatic run bills the base amount alone, and a unit can only hold one bill per month — so a secretary who builds an expense sheet on the 3rd cannot apply it to that month. Secretaries who bill by expense sheet must generate manually, before the 1st.",
        },
      ],
    },

    {
      id: "users-complaints",
      title: "Users & Complaints",
      icon: "Contact",
      blocks: [
        {
          type: "bullets",
          items: [
            "**Users** lists everyone the platform knows through WhatsApp, with their number and apartment. It's a lookup, not an editor.",
            "**Complaints** is the ticket list with filters — the place to answer *what happened with this?* rather than the place to act. Assigning happens on the Incident Dashboard.",
            "**Payments** is a placeholder: no gateway console is wired into it yet. Reconciliation lives in **Maintenance**.",
          ],
        },
      ],
    },

    {
      id: "reference",
      title: "Status reference",
      icon: "BulletedList",
      blocks: [
        { type: "p", text: "**Tickets**" },
        TICKET_STATUS_CHIPS,
        { type: "p", text: "**Vendors**" },
        {
          type: "chips",
          items: [
            { label: "VERIFICATION_PENDING", tone: "amber", d: "Awaiting your check" },
            { label: "APPROVED",             tone: "green", d: "Eligible for assignment" },
            { label: "REJECTED",             tone: "red",   d: "Declined, reason stored" },
            { label: "SUSPENDED",            tone: "slate", d: "Paused, reversible" },
          ],
        },
        { type: "p", text: "**Maintenance dues**" },
        {
          type: "chips",
          items: [
            { label: "Pending",   tone: "amber",  d: "Billed, not yet paid" },
            { label: "To verify", tone: "violet", d: "UPI payment declared, awaiting the secretary's confirmation" },
            { label: "Paid",      tone: "green",  d: "Received" },
            { label: "Overdue",   tone: "red",    d: "Past due, or caught by a month closure" },
            { label: "Waived",    tone: "slate",  d: "Written off" },
          ],
        },
      ],
    },

    {
      id: "faq",
      title: "When something looks wrong",
      icon: "Help",
      blocks: [
        {
          type: "faq",
          items: [
            {
              q: "A vendor says they can't sign in",
              a: "Most likely no portal login was ever created — the username and password are optional at registration, and skipping them leaves a vendor record with no account. Check whether they were given credentials; if the password is simply lost, it needs resetting on the backend.",
            },
            {
              q: "A secretary has lost their password",
              a: "Open the society's detail page and use **Reset secretary password**. The new temporary password is shown once, and they'll be forced to change it on sign-in.",
            },
            {
              q: "WhatsApp messages aren't becoming tickets",
              a: "Check the webhook first: the verify token has to match on Meta's side and the signature check has to pass on incoming posts. Nothing downstream works if intake is broken.",
            },
            {
              q: "A society says its bills are missing the expense breakdown",
              a: "The dues were almost certainly created by the automatic run on the 1st, which bills the base amount only. Because a unit can hold just one bill per month, those dues can't be regenerated — the fix is for them to generate manually going forward.",
            },
            {
              q: "A society's payment links don't open",
              a: "Payment links are minted at generation time and depend on a configured rail and a public backend URL. Dues created while no rail was configured have no link at all — they'll need regenerating in a later month.",
            },
            {
              q: "The Payments screen is empty",
              a: "That's expected. It's a placeholder with no gateway integration behind it. Collections and reconciliation are on **Maintenance**.",
            },
          ],
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

export const GUIDES = {
  NEXSO_ADMIN:  ADMIN_GUIDE,
  SOCIETY_ADMIN: SECRETARY_GUIDE,
  VENDOR:        VENDOR_GUIDE,
};

export function getGuide(role) {
  return GUIDES[role] || null;
}
