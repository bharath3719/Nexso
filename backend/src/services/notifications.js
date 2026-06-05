import { dbQuery } from "../db/index.js";
import { log } from "../utils/logger.js";

async function logOutbound(recipient, messageType, payload, resp) {
  const messageId = resp?.messages?.[0]?.id ?? null;
  await dbQuery(
    `INSERT INTO whatsapp_outbound_messages (message_id, recipient, message_type, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, recipient, messageType, JSON.stringify(payload)],
  ).catch((e) => log("logOutbound error", e?.message || e));
}

async function postJson(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp send failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function sendWhatsAppText(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    log("WhatsApp text send skipped: missing token or phone id");
    return { skipped: true };
  }

  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  const resp = await postJson(url, token, body);
  log("WhatsApp text sent", { to, resp });
  await logOutbound(to, "text", body, resp);
  return resp;
}


export async function sendWhatsAppInteractiveList(to, headerText, bodyText, sections, footerText) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    log("WhatsApp interactive list send skipped: missing token or phone id");
    return { skipped: true };
  }

  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: headerText },
      body: { text: bodyText },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        button: "Select Issue Type",
        sections,
      },
    },
  };

  const resp = await postJson(url, token, body);
  log("WhatsApp interactive list sent", { to, resp });
  await logOutbound(to, "interactive", body, resp);
  return resp;
}

export async function sendWhatsAppDocument(to, documentUrl, caption) {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    log("WhatsApp document send skipped: missing token or phone id");
    return { skipped: true };
  }

  const url  = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: { link: documentUrl, caption },
  };

  const resp = await postJson(url, token, body);
  log("WhatsApp document sent", { to, documentUrl, resp });
  await logOutbound(to, "document", body, resp);
  return resp;
}

export async function notifyVendor(ticket, vendor) {
  if (!vendor?.whatsapp_number) {
    log("notifyVendor skipped: vendor has no whatsapp_number", { vendorId: vendor?.id });
    return { skipped: true };
  }

  const ticketRef   = ticket.ticket_id || `#${ticket.id}`;
  const category    = ticket.category || "GENERAL";
  const description = ticket.description || "No description";
  const society     = ticket.society_name || "";
  const apartment   = ticket.raised_by_apartment || "";
  const location    = [society, apartment ? `Apt ${apartment}` : ""].filter(Boolean).join(", ");

  const residentNumber = ticket.raised_by_number || ticket.raised_by_whatsapp || "";
  const contactLine    = residentNumber ? `\nResident WhatsApp: ${residentNumber}` : "";
  const portalUrl      = process.env.VENDOR_PORTAL_URL || "http://localhost:5173";
  const msg = `New complaint assigned to you!\n\nTicket: ${ticketRef}\nCategory: ${category}\nLocation: ${location || "—"}\nDetails: ${description}${contactLine}\n\nLogin to your portal to manage this ticket:\n${portalUrl}\n\nPlease attend to this promptly.`;

  const result = await sendWhatsAppText(vendor.whatsapp_number, msg).catch((e) => {
    log("notifyVendor send error", e?.message || e);
    return { error: e?.message };
  });

  await dbQuery(
    `INSERT INTO ticket_activity_logs (ticket_id, actor_role, note) VALUES ($1, $2, $3)`,
    [ticket.id, "SYSTEM", `WhatsApp notification sent to vendor ${vendor.id} (${vendor.whatsapp_number})`],
  ).catch(() => {});

  return result;
}
