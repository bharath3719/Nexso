import { dbQuery } from "../db/index.js";
import { log } from "../utils/logger.js";

export async function findMessageById(messageId) {
  const res = await dbQuery("SELECT * FROM whatsapp_messages WHERE message_id = $1", [messageId]);
  return res && res.rows && res.rows[0] ? res.rows[0] : null;
}

export async function persistRawMessage(msg) {
  try {
    const { message_id, sender_whatsapp_number, timestamp, message_type, raw_message_payload } = msg;
    const res = await dbQuery(
      `INSERT INTO whatsapp_messages (message_id, sender_whatsapp_number, timestamp, message_type, raw_message_payload)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (message_id) DO NOTHING
       RETURNING *`,
      [message_id, sender_whatsapp_number, timestamp, message_type, raw_message_payload],
    );
    if (!res) {
      // No DB mode
      log("No-DB mode: raw message persisted only in memory/log", msg.message_id || "no-id");
      return { noDb: true };
    }
    return res.rows[0] || { ok: true };
  } catch (err) {
    log("persistRawMessage error:", err);
    return { error: true };
  }
}
