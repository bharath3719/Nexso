const CREATE_KEYWORDS = [
  "raise service request",
  "create ticket",
  // categories and common synonyms
  "plumbing",
  "plumb",
  "electrical",
  "electric",
  "electrician",
  "security",
  // general problem words
  "leak",
  "repair",
  "issue",
  "fault",
  "power",
  "water",
];

export function detectIntent(msg) {
  try {
    const text = (msg?.text || msg?.raw_message_payload?.text?.body || msg?.raw_message_payload?.text || "").toLowerCase();
    const isCreate = CREATE_KEYWORDS.some((k) => text.includes(k));

    if (isCreate) return "CREATE_TICKET";

    // If payload references a known ticket id, treat as update
    const hasTicketId = /ticket\s*#?\s*(\w+)/.test(text) || msg?.raw_message_payload?.ticket_id;
    if (hasTicketId) return "UPDATE_TICKET";

    return "OTHER";
  } catch {
    return "OTHER";
  }
}
