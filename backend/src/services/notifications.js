import { dbQuery } from "../db/index.js";
import { log } from "../utils/logger.js";

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
  return resp;
}

export async function sendWhatsAppTemplate(to, templateName, language = "en_US") {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    log("WhatsApp send skipped: missing token or phone id");
    return { skipped: true };
  }

  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

  // Flows CTA templates already carry the button definition in Meta; leave components undefined
  let components = undefined;
  if (process.env.WHATSAPP_TEMPLATE_COMPONENTS) {
    try {
      components = JSON.parse(process.env.WHATSAPP_TEMPLATE_COMPONENTS);
    } catch (e) {
      log("WHATSAPP_TEMPLATE_COMPONENTS parse error", e?.message || e);
      components = undefined;
    }
  }

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components ? { components } : {}),
    },
  };

  const resp = await postJson(url, token, body);
  log("WhatsApp template sent", { to, templateName, resp });
  return resp;
}

export async function notifyVendor(ticket, vendor) {
  // Stub: Integrate WhatsApp Business provider send API here.
  const sentAt = new Date().toISOString();
  // If provider returns delivery status, store it.
  (await dbQuery) &&
    dbQuery(
      `INSERT INTO ticket_activity_logs (ticket_id, actor_role, note)
     VALUES ($1, $2, $3)`,
      [ticket.id, "SYSTEM", `Notification sent to vendor ${vendor?.id} at ${sentAt}`],
    );
  return { sentAt };
}
