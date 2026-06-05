import express from "express";
import { verifySignature, log } from "../utils/logger.js";
import { persistRawMessage, findMessageById } from "../services/messages.js";
import { resolveIdentity } from "../services/identity.js";
import { detectIntent } from "../services/intent.js";
import { createTicketIfNeeded, updateTicketIfNeeded } from "../services/tickets.js";
import { sendWhatsAppText, sendWhatsAppInteractiveList } from "../services/notifications.js";
import { dbQuery } from "../db/index.js";

const router = express.Router();

// ── Session store ─────────────────────────────────────────────────────────────
// Tracks the category a user selected from the interactive list so the next
// plain-text message knows which category to file the ticket under.

const userSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function getSession(number) {
  const s = userSessions.get(number);
  if (!s || Date.now() > s.expiresAt) {
    userSessions.delete(number);
    return null;
  }
  return s;
}

function setSession(number, data) {
  userSessions.set(number, { ...data, expiresAt: Date.now() + SESSION_TTL_MS });
}

// ── Issue category menu ───────────────────────────────────────────────────────

const ISSUE_SECTIONS = [
  {
    title: "Home Services",
    rows: [
      { id: "ELECTRICAL",   title: "Electricians",    description: "Electrical repairs & faults" },
      { id: "PLUMBING",     title: "Plumbers",         description: "Water leaks & pipe issues" },
      { id: "HOUSEKEEPING", title: "Housekeeping",     description: "Cleaning & sanitation" },
      { id: "PEST_CONTROL", title: "Pest Control",     description: "Pests, insects & rodents" },
      { id: "APPLIANCE",    title: "Appliance Repair", description: "Broken appliances" },
      { id: "AC",           title: "AC Servicing",     description: "Air conditioning repairs" },
    ],
  },
  {
    title: "Building Services",
    rows: [
      { id: "CCTV",      title: "CCTV Technicians",    description: "Camera & surveillance issues" },
      { id: "LIFT",      title: "Lift Maintenance",     description: "Elevator issues" },
      { id: "SECURITY",  title: "Security Agencies",    description: "Security & access issues" },
      { id: "GENERATOR", title: "Generator Maintenance", description: "Power backup issues" },
    ],
  },
];

// ── Payload parsing helpers ───────────────────────────────────────────────────

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function fieldsFromElements(elements) {
  if (!elements?.length) return {};
  return Object.fromEntries(
    elements
      .filter((e) => e?.name)
      .map((e) => [e.name, e.value ?? e.text ?? e.answer ?? e.input ?? ""]),
  );
}

function fieldsFromResponseObject(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return {};

  const SKIP_KEYS = new Set(["flow_token", "screen", "version", "action"]);

  for (const candidate of [response, response.data, response.payload]) {
    if (!candidate) continue;
    const entries = Object.entries(candidate).filter(
      ([key, value]) => !SKIP_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value),
    );
    if (entries.length) return Object.fromEntries(entries);
  }

  return {};
}

function extractFlowFormFields(interactive) {
  const nfmReply = interactive?.nfm_reply;
  if (!nfmReply) return {};

  const responseJson = safeParseJson(nfmReply.response_json);
  const bodyParams   = safeParseJson(nfmReply.body?.params);

  const candidates = [
    fieldsFromElements(nfmReply.elements),
    fieldsFromElements(responseJson?.elements),
    fieldsFromElements(bodyParams),
    fieldsFromResponseObject(responseJson),
    fieldsFromResponseObject(bodyParams),
  ];

  return candidates.find((fields) => Object.keys(fields).length) || {};
}

function extractWhatsAppStatus(body) {
  const value  = body?.entry?.[0]?.changes?.[0]?.value;
  const status = value?.statuses?.[0];
  if (!status) return null;

  return {
    message_id:             status.id || null,
    sender_whatsapp_number: status.recipient_id || null,
    timestamp:              new Date((status.timestamp ? Number(status.timestamp) * 1000 : Date.now())).toISOString(),
    message_type:           "status",
    status:                 status.status,
    error:                  status.errors?.[0],
    raw_message_payload:    status,
  };
}

function extractWhatsAppMessage(body) {
  const value   = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  if (!message) return null;

  const interactive = message.type === "interactive" ? message.interactive : null;

  return {
    message_id:             message.id || null,
    sender_whatsapp_number: message.from || contact?.wa_id || null,
    timestamp:              new Date((message.timestamp ? Number(message.timestamp) * 1000 : Date.now())).toISOString(),
    message_type:           message.type || "other",
    text:                   message.text?.body,
    form_fields:            extractFlowFormFields(interactive),
    list_reply:             interactive?.type === "list_reply" ? interactive.list_reply : null,
    raw_message_payload:    message,
  };
}

function normalizePayload(body) {
  return (
    extractWhatsAppStatus(body) ||
    extractWhatsAppMessage(body) || {
      // Fallback for legacy/simple payloads used in local testing
      message_id:             body.message_id || body.id || null,
      sender_whatsapp_number: body.sender_whatsapp_number || body.from || null,
      timestamp:              body.timestamp || body.time || new Date().toISOString(),
      message_type:           body.message_type || body.type || (body.text ? "text" : body.image ? "image" : "other"),
      text:                   body.text,
      raw_message_payload:    body,
    }
  );
}

function isGreeting(text) {
  return /^(hi+|hello|hey|hii+|howdy|good\s*(morning|evening|afternoon)|namaste|helo+|yo|sup)\s*[!.]*$/i.test(
    (text || "").trim(),
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getRecentTicketsForUser(userId) {
  if (!userId) return [];
  const r = await dbQuery(
    "SELECT * FROM tickets WHERE raised_by_user_id = $1 ORDER BY created_at DESC LIMIT 5",
    [userId],
  );
  return r?.rows || [];
}

async function getUserName(userId) {
  if (!userId) return null;
  const r = await dbQuery("SELECT name FROM users WHERE id = $1", [userId]);
  return r?.rows?.[0]?.name || null;
}

// ── Webhook verification (GET) ────────────────────────────────────────────────

router.get("/whatsapp", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && challenge && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ── Incoming messages (POST) ──────────────────────────────────────────────────

router.post("/whatsapp", async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"] || req.headers["x-hub-signature"] || req.headers["x-whatsapp-signature"];
    log("Webhook POST /whatsapp incoming", { headers: req.headers, body: req.body });

    if (!verifySignature(signature, req.rawBody)) {
      return res.status(403).json({ error: "invalid_signature" });
    }

    const normalized = normalizePayload(req.body || {});
    log("Webhook normalized payload", normalized);

    if (!normalized.message_id && !normalized.sender_whatsapp_number) {
      return res.status(200).json({ status: "ignored", reason: "no_message" });
    }

    // Delivery/status callback — update outbound record and exit
    if (normalized.message_type === "status") {
      log("Webhook status callback", normalized);
      if (normalized.message_id && normalized.status) {
        await dbQuery(
          `UPDATE whatsapp_outbound_messages SET status = $1, status_updated_at = NOW() WHERE message_id = $2`,
          [normalized.status, normalized.message_id],
        ).catch(() => {});
      }
      return res.status(200).json({ status: "ok", delivery: normalized });
    }

    // Idempotency — fast-ack if already processed
    if (normalized.message_id) {
      const existing = await findMessageById(normalized.message_id);
      if (existing) return res.status(200).json({ status: "ok", idempotent: true });
    }

    const saved    = await persistRawMessage(normalized);
    const identity = await resolveIdentity(normalized.sender_whatsapp_number);
    log("Webhook identity resolved", identity);

    const sendText = (text) =>
      sendWhatsAppText(normalized.sender_whatsapp_number, text).catch((e) =>
        log("WhatsApp send error", e?.message || e),
      );

    // Unit has a tenant — only the current occupant can raise tickets
    if (identity?.role === "NOT_OCCUPANT") {
      sendText("Hi! This unit currently has a tenant. Complaints can only be raised by the current occupant. Please contact your society secretary if this is incorrect.");
      return res.status(200).json({ status: "ok", saved, identity, flow: "not_occupant" });
    }

    // Unknown number — must be registered by admin first
    if (!identity?.user_id) {
      sendText("Hi! Your number isn't registered with our society management system. Please contact your society secretary to get added.");
      return res.status(200).json({ status: "ok", saved, identity, flow: "not_registered" });
    }

    // Interactive list reply — user picked a category
    if (normalized.message_type === "interactive" && normalized.list_reply) {
      const { id: category, title: categoryTitle } = normalized.list_reply;
      setSession(normalized.sender_whatsapp_number, { category, categoryTitle });
      sendText(`You've selected *${categoryTitle}*.\n\nPlease describe the issue in a few words and we'll log a complaint right away.`);
      return res.status(200).json({ status: "ok", saved, identity, flow: "category_selected", category });
    }

    const intent = detectIntent(normalized);
    log("Webhook intent", intent);
    let result = { intent };

    if (intent === "UPDATE_TICKET") {
      result = await updateTicketIfNeeded(normalized, identity);
      const reply = result?.error
        ? `Could not update ticket: ${result.error}`
        : `Ticket ${result.ticket_id} updated to ${result.status}.`;
      sendText(reply);
    } else if (!isGreeting(normalized.text)) {
      // Any problem description → create a ticket
      const session = getSession(normalized.sender_whatsapp_number);
      const msgForTicket = session ? { ...normalized, override_category: session.category } : normalized;
      if (session) userSessions.delete(normalized.sender_whatsapp_number);

      result = await createTicketIfNeeded(msgForTicket, identity);

      let reply;
      if (result?.error) {
        reply = `Sorry, we couldn't log your complaint: ${result.reason || result.error}`;
      } else if (result?.deduplicated_ticket_id) {
        reply = `We already have an open ticket for this (${result.deduplicated_ticket_id}). We'll keep you posted.`;
      } else if (result?.ticket_id) {
        reply = `Got it! Your complaint has been logged (${result.ticket_id}). Our team will review it and assign someone shortly.`;
      } else {
        reply = process.env.WHATSAPP_TEXT_REPLY || "Your request has been recorded.";
      }
      sendText(reply);
    } else {
      // Greeting → send the issue category menu
      const name       = identity?.name || await getUserName(identity.user_id);
      const headerText = name ? `Hi ${name}! How can we help?` : "Hi! How can we help?";

      const recentTickets = await getRecentTicketsForUser(identity.user_id);
      let bodyText = "Please select the type of issue you're facing:";
      if (recentTickets.length) {
        bodyText += `\n\nRecent complaints: ${recentTickets.map((t) => `${t.ticket_id} (${t.status})`).join(", ")}`;
      }

      sendWhatsAppInteractiveList(
        normalized.sender_whatsapp_number,
        headerText,
        bodyText,
        ISSUE_SECTIONS,
        "Nexso Society Management",
      ).catch((e) => log("WhatsApp interactive list send error", e?.message || e));
    }

    return res.status(200).json({ status: "ok", saved, identity, result });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
