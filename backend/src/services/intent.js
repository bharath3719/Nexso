export function detectIntent(msg) {
  try {
    const text = (msg?.text || msg?.raw_message_payload?.text?.body || msg?.raw_message_payload?.text || "").toLowerCase();
    // Only special case: resident referencing a specific ticket ID → status update
    const hasTicketRef = /ticket\s*#?\s*(t-\d+)/i.test(text) || msg?.raw_message_payload?.ticket_id;
    if (hasTicketRef) return "UPDATE_TICKET";
    return "OTHER";
  } catch {
    return "OTHER";
  }
}
