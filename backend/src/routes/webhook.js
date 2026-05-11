import express from "express";
import { verifySignature, log } from "../utils/logger.js";
import { persistRawMessage, findMessageById } from "../services/messages.js";
import { resolveIdentity } from "../services/identity.js";
import { detectIntent } from "../services/intent.js";
import { createTicketIfNeeded, updateTicketIfNeeded } from "../services/tickets.js";
import { sendWhatsAppTemplate, sendWhatsAppText } from "../services/notifications.js";
import { dbQuery } from "../db/index.js";

const router = express.Router();

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

 return {
 message_id: message.id || null,
 sender_whatsapp_number: message.from || contact?.wa_id || null,
 timestamp: new Date(tsMillis).toISOString(),
 message_type: message.type || "other",
 text: message.text?.body,
 form_fields,
 raw_message_payload: message,
 };
}

async function getRecentTicketsForUser(userId) {
 if (!userId) return [];
 const r = await dbQuery("SELECT * FROM tickets WHERE raised_by_user_id = $1 ORDER BY created_at DESC LIMIT 5", [userId]);
 return r?.rows || [];
}

function formatTicketSummary(tickets) {
 if (!tickets?.length) return "No previous complaints found. Reply with your issue to raise a new complaint.";
 const lines = tickets.map((t) => `${t.id || t.ticket_id || "#"}: ${t.status || "OPEN"} - ${t.category || ""}`);
 return `Your recent complaints:\n${lines.join("\n")}`;
}

async function getSession(whatsappNumber) {
 if (!whatsappNumber) return null;
 const r = await dbQuery("SELECT * FROM whatsapp_sessions WHERE whatsapp_number = $1", [whatsappNumber]);
 return r?.rows?.[0] || null;
}

async function saveSession(whatsappNumber, state, context) {
 if (!whatsappNumber) return null;
 const r = await dbQuery(
 `INSERT INTO whatsapp_sessions (whatsapp_number, state, context, updated_at)
 VALUES ($1,$2,$3,NOW())
 ON CONFLICT (whatsapp_number) DO UPDATE SET state = EXCLUDED.state, context = EXCLUDED.context, updated_at = NOW()
 RETURNING *`,
 [whatsappNumber, state, context || {}],
 );
 return r?.rows?.[0] || null;
}

async function clearSession(whatsappNumber) {
 if (!whatsappNumber) return;
 await dbQuery("DELETE FROM whatsapp_sessions WHERE whatsapp_number = $1", [whatsappNumber]);
}

async function findSocietyByName(name) {
 if (!name) return null;
 const r = await dbQuery("SELECT * FROM societies WHERE LOWER(name) = LOWER($1) LIMIT 1", [name]);
 return r?.rows?.[0] || null;
}

async function findSocietyByCode(code) {
 if (!code) return null;
 const r = await dbQuery("SELECT * FROM societies WHERE LOWER(code) = LOWER($1) LIMIT 1", [code]);
 return r?.rows?.[0] || null;
}

async function createSociety(name) {
 const r = await dbQuery("INSERT INTO societies (name) VALUES ($1) RETURNING *", [name]);
 return r?.rows?.[0] || null;
}

async function createUser({ whatsapp_number, society_id, apartment, name = null, role = "resident" }) {
 const r = await dbQuery("INSERT INTO users (whatsapp_number, name, role, society_id, apartment) VALUES ($1,$2,$3,$4,$5) RETURNING *", [whatsapp_number, name, role, society_id, apartment]);
 return r?.rows?.[0] || null;
}

async function upsertUserFromFlow(whatsappNumber, fields, identity) {
 if (!whatsappNumber) return identity;

 const societyCode = fields.society_code || fields.code || null;
 const apartment = fields.apartment || fields.flat || null;
 const name = fields.name || fields.full_name || null;

 if (!societyCode) {
 return { error: "missing_society_code" };
 }

 const society = await findSocietyByCode(societyCode);
 if (!society) {
 return { error: "invalid_society_code" };
 }

 // If user exists, update missing fields
 const existing = await dbQuery("SELECT * FROM users WHERE whatsapp_number = $1 LIMIT 1", [whatsappNumber]);
 const user = existing?.rows?.[0];
 if (user) {
 const sets = [];
 const params = [];
 if (name) {
 params.push(name);
 sets.push(`name = $${params.length}`);
 }
 if (apartment) {
 params.push(apartment);
 sets.push(`apartment = $${params.length}`);
 }
 if (!user.society_id) {
 params.push(society.id);
 sets.push(`society_id = $${params.length}`);
 }
 if (sets.length) {
 params.push(user.id);
 await dbQuery(`UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`, params);
 }
 return { role: user.role || "OWNER", user_id: user.id, society_id: user.society_id || society.id };
 }

 const created = await createUser({ whatsapp_number: whatsappNumber, name, apartment, society_id: society.id, role: "OWNER" });
 return { role: created?.role || "OWNER", user_id: created?.id, society_id: created?.society_id || society.id };
}

async function handleRegistrationFlow(whatsappNumber, text) {
 const msg = (text || "").trim();
 let session = await getSession(whatsappNumber);

 if (!session) {
 session = await saveSession(whatsappNumber, "awaiting_society", {});
 return "Welcome! Please share your society name to register.";
 }

 if (session.state === "awaiting_society") {
 if (!msg) return "Please share your society name to continue.";
 const ctx = { society_name: msg };
 await saveSession(whatsappNumber, "awaiting_apartment", ctx);
 return "Got it. Please share your apartment/flat number.";
 }

 if (session.state === "awaiting_apartment") {
 if (!msg) return "Please share your apartment/flat number.";
 const societyName = session.context?.society_name;
 let society = await findSocietyByName(societyName);
 if (!society) {
 society = await createSociety(societyName);
 }
 const user = await createUser({ whatsapp_number: whatsappNumber, society_id: society?.id, apartment: msg });
 await clearSession(whatsappNumber);
 return `Registered. Society: ${society?.name || societyName}. Apartment: ${msg}. Reply with your issue to raise a complaint.`;
 }

 await clearSession(whatsappNumber);
 return "Let's start again. Please share your society name.";
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

 // If this is a delivery/status callback, log and exit
 if (normalized.message_type === "status") {
 log("Webhook status callback", normalized);
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

 // If configured, auto-respond with a template that launches the flow.
 // Restrict this to unregistered users so existing users can continue via text.
 const flowTemplateName = process.env.WHATSAPP_FLOW_TEMPLATE_NAME;
 const flowTemplateLang = process.env.WHATSAPP_FLOW_TEMPLATE_LANG || "en_US";
 const flowEnabled = process.env.WHATSAPP_FLOW_ENABLED !== "false"; // set to "false" to force plain text path
 if (flowEnabled && flowTemplateName && !identity?.user_id && normalized.message_type !== "interactive" && normalized.message_type !== "status") {
 sendWhatsAppTemplate(normalized.sender_whatsapp_number, flowTemplateName, flowTemplateLang).catch((e) => log("WhatsApp template send error", e?.message || e));
 return res.status(200).json({ status: "ok", saved, template_sent: flowTemplateName });
 }

 // Flow submission (interactive nfm reply) carries form fields; create/update user + ticket
 if (normalized.message_type === "interactive" && normalized.form_fields && Object.keys(normalized.form_fields).length) {
 const fields = normalized.form_fields;
 identity = await upsertUserFromFlow(normalized.sender_whatsapp_number, fields, identity);

 if (identity?.error === "missing_society_code") {
 sendWhatsAppText(normalized.sender_whatsapp_number, "Please provide the society code we shared to proceed.").catch((e) => log("WhatsApp text send error", e?.message || e));
 return res.status(200).json({ status: "error", reason: "missing_society_code" });
 }

 if (identity?.error === "invalid_society_code") {
 sendWhatsAppText(normalized.sender_whatsapp_number, "That society code is not valid. Please check the code and try again.").catch((e) => log("WhatsApp text send error", e?.message || e));
 return res.status(200).json({ status: "error", reason: "invalid_society_code" });
 }

 const flowMsg = {
 text: fields.issue || fields.problem || fields.description || normalized.text,
 raw_message_payload: { ...normalized.raw_message_payload, form_fields: fields },
 };

 const result = await createTicketIfNeeded(flowMsg, identity);

 if (normalized.sender_whatsapp_number) {
 let reply;
 if (result?.error) {
 reply = `Could not create ticket: ${result.reason || result.error}`;
 } else if (result?.deduplicated_ticket_id) {
 reply = `We already have a recent ticket ${result.deduplicated_ticket_id}. We will keep you posted.`;
 } else if (result?.ticket_id) {
 reply = `Ticket created: ${result.ticket_id}. Status: ${result.status || "OPEN"}.`;
 } else {
 reply = process.env.WHATSAPP_TEXT_REPLY || "Your request is recorded.";
 }
 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 }

 return res.status(200).json({ status: "ok", saved, identity, result, source: "flow" });
 }

 // Onboard flow for unknown users
 if (!identity?.user_id) {
 const reply = await handleRegistrationFlow(normalized.sender_whatsapp_number, normalized.text);
 if (reply) sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 return res.status(200).json({ status: "ok", saved, identity, flow: "registration" });
 }

 // Detect intent
 const intent = detectIntent(normalized);
 log("Webhook intent", intent);

 let result = { intent };

 if (intent === "CREATE_TICKET") {
 result = await createTicketIfNeeded(normalized, identity);

 if (normalized.sender_whatsapp_number) {
 let reply;
 if (result?.error) {
 reply = `Could not create ticket: ${result.reason || result.error}`;
 } else if (result?.deduplicated_ticket_id) {
 reply = `We already have a recent ticket ${result.deduplicated_ticket_id}. We will keep you posted.`;
 } else if (result?.ticket_id) {
 reply = `Ticket created: ${result.ticket_id}. Status: ${result.status || "OPEN"}.`;
 } else {
 reply = process.env.WHATSAPP_TEXT_REPLY || "Your request is recorded.";
 }

 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 }
 } else if (intent === "UPDATE_TICKET") {
 result = await updateTicketIfNeeded(normalized, identity);

 if (normalized.sender_whatsapp_number) {
 const reply = result?.error ? `Could not update ticket: ${result.error}` : `Ticket ${result.ticket_id} updated to ${result.status}.`;
 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 }
 } else {
 // OTHER intent: send open-ticket summary or menu
 if (normalized.sender_whatsapp_number) {
 const tickets = await getRecentTicketsForUser(identity.user_id);
 const reply = formatTicketSummary(tickets);
 sendWhatsAppText(normalized.sender_whatsapp_number, reply).catch((e) => log("WhatsApp text send error", e?.message || e));
 }
 }

 return res.status(200).json({ status: "ok", saved, identity, result });
 } catch (err) {
 console.error("Webhook error:", err);
 return res.status(500).json({ error: "internal_error" });
 }
});

export default router;
