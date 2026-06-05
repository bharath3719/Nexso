import express from "express";
import { verifySignature, log } from "../utils/logger.js";
import { persistRawMessage, findMessageById } from "../services/messages.js";
import { resolveIdentity } from "../services/identity.js";
import { detectIntent } from "../services/intent.js";
import { createTicketIfNeeded, updateTicketIfNeeded } from "../services/tickets.js";
import { sendWhatsAppText, sendWhatsAppInteractiveList } from "../services/notifications.js";
import { dbQuery } from "../db/index.js";

const router = express.Router();

// In-memory sessions: whatsapp_number → { category, categoryTitle, expiresAt }
// Used to carry the category a user picked from the interactive list to their next message.
const userSessions = new Map();

function getSession(number) {
  const s = userSessions.get(number);
  if (!s || Date.now() > s.expiresAt) {
    userSessions.delete(number);
    return null;
  }
  return s;
}

function setSession(number, data) {
  userSessions.set(number, { ...data, expiresAt: Date.now() + 30 * 60 * 1000 });
}

const ISSUE_SECTIONS = [
  {
    title: "Home Services",
    rows: [
      { id: "ELECTRICAL", title: "Electricians", description: "Electrical repairs & faults" },
      { id: "PLUMBING", title: "Plumbers", description: "Water leaks & pipe issues" },
      { id: "HOUSEKEEPING", title: "Housekeeping", description: "Cleaning & sanitation" },
      { id: "PEST_CONTROL", title: "Pest Control", description: "Pests, insects & rodents" },
      { id: "APPLIANCE", title: "Appliance Repair", description: "Broken appliances" },
      { id: "AC", title: "AC Servicing", description: "Air conditioning repairs" },
    ],
  },
  {
    title: "Building Services",
    rows: [
      { id: "CCTV", title: "CCTV Technicians", description: "Camera & surveillance issues" },
      { id: "LIFT", title: "Lift Maintenance", description: "Elevator issues" },
      { id: "SECURITY", title: "Security Agencies", description: "Security & access issues" },
      { id: "GENERATOR", title: "Generator Maintenance", description: "Power backup issues" },
    ],
  },
];

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
 return Object.fromEntries((elements || []).filter((entry) => entry && entry.name).map((entry) => [entry.name, entry.value ?? entry.text ?? entry.answer ?? entry.input ?? ""]));
}

function fieldsFromResponseObject(response) {
 if (!response || typeof response !== "object" || Array.isArray(response)) return {};

 const candidates = [response, response.data, response.payload].filter(Boolean);
 for (const candidate of candidates) {
 const entries = Object.entries(candidate).filter(([key, value]) => {
 if (["flow_token", "screen", "version", "action"].includes(key)) return false;
 return ["string", "number", "boolean"].includes(typeof value);
 });

 if (entries.length) {
 return Object.fromEntries(entries);
 }
 }

 return {};
}

function extractFlowFormFields(interactive) {
 const nfmReply = interactive?.nfm_reply;
 if (!nfmReply) return {};

 const responseJson = safeParseJson(nfmReply.response_json);
 const bodyParams = safeParseJson(nfmReply.body?.params);

 const candidates = [fieldsFromElements(nfmReply.elements), fieldsFromElements(responseJson?.elements), fieldsFromElements(bodyParams), fieldsFromResponseObject(responseJson), fieldsFromResponseObject(bodyParams)];

 return candidates.find((fields) => Object.keys(fields).length) || {};
}

function extractWhatsAppStatus(body) {
 const change = body?.entry?.[0]?.changes?.[0]?.value;
 const status = change?.statuses?.[0];
 if (!status) return null;

 const tsMillis = status.timestamp ? Number(status.timestamp) * 1000 : Date.now();

 return {
 message_id: status.id || null,
 sender_whatsapp_number: status.recipient_id || null,
 timestamp: new Date(tsMillis).toISOString(),
 message_type: "status",
 status: status.status,
 error: status.errors?.[0],
 raw_message_payload: status,
 };
}

function extractWhatsAppMessage(body) {
 const change = body?.entry?.[0]?.changes?.[0]?.value;
 const message = change?.messages?.[0];
 const contact = change?.contacts?.[0];
 if (!message) return null;

 const tsMillis = message.timestamp ? Number(message.timestamp) * 1000 : Date.now();

 const interactive = message.type === "interactive" ? message.interactive : null;
 const form_fields = extractFlowFormFields(interactive);
 const list_reply = interactive?.type === "list_reply" ? interactive.list_reply : null;

 return {
 message_id: message.id || null,
 sender_whatsapp_number: message.from || contact?.wa_id || null,
 timestamp: new Date(tsMillis).toISOString(),
 message_type: message.type || "other",
 text: message.text?.body,
 form_fields,
 list_reply,
 raw_message_payload: message,
 };
}

async function getRecentTicketsForUser(userId) {
 if (!userId) return [];
 const r = await dbQuery("SELECT * FROM tickets WHERE raised_by_user_id = $1 ORDER BY created_at DESC LIMIT 5", [userId]);
 return r?.rows || [];
}

async function getUserName(userId) {
 if (!userId) return null;
 const r = await dbQuery("SELECT name FROM users WHERE id = $1", [userId]);
 return r?.rows?.[0]?.name || null;
}

function isGreeting(text) {
 return /^(hi+|hello|hey|hii+|howdy|good\s*(morning|evening|afternoon)|namaste|helo+|yo|sup)\s*[!.]*$/i.test((text || "").trim());
}


function normalizePayload(body) {
 const st = extractWhatsAppStatus(body);
 if (st) return st;

 const wa = extractWhatsAppMessage(body);
 if (wa) return wa;

 // Fallback for legacy/simple payloads used in local testing
 return {
 message_id: body.message_id || body.id || null,
 sender_whatsapp_number: body.sender_whatsapp_number || body.from || null,
 timestamp: body.timestamp || body.time || new Date().toISOString(),
 message_type: body.message_type || body.type || (body.text ? "text" : body.image ? "image" : "other"),
 text: body.text,
 raw_message_payload: body,
 };
}

router.get("/whatsapp", (req, res) => {
 const mode = req.query["hub.mode"];
 const token = req.query["hub.verify_token"];
 const challenge = req.query["hub.challenge"];
 const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

 if (mode === "subscribe" && token && challenge && token === verifyToken) {
 return res.status(200).send(challenge);
 }

 return res.sendStatus(403);
});

router.post("/whatsapp", async (req, res) => {
 try {
 const signature = req.headers["x-hub-signature-256"] || req.headers["x-hub-signature"] || req.headers["x-whatsapp-signature"];
 const body = req.body || {};

 log("Webhook POST /whatsapp incoming", { headers: req.headers, body });

 // Signature verification (strict when secret present)
 const ok = verifySignature(signature, req.rawBody);
 if (!ok) {
 return res.status(403).json({ error: "invalid_signature" });
 }

 // Basic required fields; provider payloads vary, we normalize here
 const normalized = normalizePayload(body);

 log("Webhook normalized payload", normalized);

 if (!normalized.message_id && !normalized.sender_whatsapp_number) {
 return res.status(200).json({ status: "ignored", reason: "no_message" });
 }

 // If this is a delivery/status callback, update outbound record and exit
 if (normalized.message_type === "status") {
 log("Webhook status callback", normalized);
 if (normalized.message_id && normalized.status) {
   await dbQuery(
     `UPDATE whatsapp_outbound_messages
      SET status = $1, status_updated_at = NOW()
      WHERE message_id = $2`,
     [normalized.status, normalized.message_id],
   ).catch(() => {});
 }
 return res.status(200).json({ status: "ok", delivery: normalized });
 }

 // Idempotency guard: if already seen, fast-ack
 if (normalized.message_id) {
 const existing = await findMessageById(normalized.message_id);
 if (existing) {
 return res.status(200).json({ status: "ok", idempotent: true });
 }
 }

 // Persist raw payload (debugging & legal logs)
 const saved = await persistRawMessage(normalized);

 // Identify sender
 let identity = await resolveIdentity(normalized.sender_whatsapp_number);
 log("Webhook identity resolved", identity);


 // Interactive list reply — user picked a category from the menu
 if (normalized.message_type === "interactive" && normalized.list_reply) {
 const { id: category, title: categoryTitle } = normalized.list_reply;
 setSession(normalized.sender_whatsapp_number, { category, categoryTitle });
 const reply = `You've selected *${categoryTitle}*.\n\nPlease describe the issue in a few words and we'll log a complaint right away.`;
 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 return res.status(200).json({ status: "ok", saved, identity, flow: "category_selected", category });
 }

 // Not the current occupant — unit has a tenant, owner cannot raise tickets
 if (identity?.role === "NOT_OCCUPANT") {
 sendWhatsAppText(normalized.sender_whatsapp_number, "Hi! This unit currently has a tenant. Complaints can only be raised by the current occupant. Please contact your society secretary if this is incorrect.").catch((e) => log("WhatsApp text send error", e?.message || e));
 return res.status(200).json({ status: "ok", saved, identity, flow: "not_occupant" });
 }

 // Unknown number — resident must be pre-registered by admin
 if (!identity?.user_id) {
 sendWhatsAppText(normalized.sender_whatsapp_number, "Hi! Your number isn't registered with our society management system. Please contact your society secretary to get added.").catch((e) => log("WhatsApp text send error", e?.message || e));
 return res.status(200).json({ status: "ok", saved, identity, flow: "not_registered" });
 }

 // Detect intent
 const intent = detectIntent(normalized);
 log("Webhook intent", intent);

 let result = { intent };

 if (intent === "UPDATE_TICKET") {
 // Resident referenced a ticket ID — update its status
 result = await updateTicketIfNeeded(normalized, identity);
 if (normalized.sender_whatsapp_number) {
 const reply = result?.error ? `Could not update ticket: ${result.error}` : `Ticket ${result.ticket_id} updated to ${result.status}.`;
 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 }
 } else if (!isGreeting(normalized.text)) {
 // Any description of a problem → raise a ticket, no keyword matching needed
 const session = getSession(normalized.sender_whatsapp_number);
 const msgForTicket = session ? { ...normalized, override_category: session.category } : normalized;
 if (session) userSessions.delete(normalized.sender_whatsapp_number);
 result = await createTicketIfNeeded(msgForTicket, identity);
 if (normalized.sender_whatsapp_number) {
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
 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 }
 } else {
 // Greeting → send interactive issue-category list
 const name = identity?.name || (identity?.user_id ? await getUserName(identity.user_id) : null);
 const headerText = name ? `Hi ${name}! How can we help?` : "Hi! How can we help?";
 const recentTickets = await getRecentTicketsForUser(identity.user_id);
 let bodyText = "Please select the type of issue you're facing:";
 if (recentTickets.length) {
 bodyText += `\n\nRecent complaints: ${recentTickets.map((t) => `${t.ticket_id} (${t.status})`).join(", ")}`;
 }
 if (normalized.sender_whatsapp_number) {
 sendWhatsAppInteractiveList(normalized.sender_whatsapp_number, headerText, bodyText, ISSUE_SECTIONS, "Nexso Society Management").catch((e) => log("WhatsApp interactive list send error", e?.message || e));
 }
 }

 return res.status(200).json({ status: "ok", saved, identity, result });
 } catch (err) {
 console.error("Webhook error:", err);
 return res.status(500).json({ error: "internal_error" });
 }
});

export default router;
