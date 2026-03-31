import dotenv from "dotenv";
dotenv.config();

import { dbQuery } from "../src/db/index.js";

async function main() {
  const whatsappNumber = process.env.TEST_WHATSAPP_NUMBER || "+918892190816";
  const societyId = process.env.TEST_SOCIETY_ID || 1;
  const role = process.env.TEST_USER_ROLE || "OWNER";

  const res = await dbQuery(
    `INSERT INTO users (whatsapp_number, society_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (whatsapp_number) DO UPDATE SET society_id = EXCLUDED.society_id, role = EXCLUDED.role
     RETURNING *`,
    [whatsappNumber, societyId, role],
  );

  console.log("Inserted/updated user:", res.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
