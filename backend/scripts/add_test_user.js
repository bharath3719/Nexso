import dotenv from "dotenv";
dotenv.config();

import { dbQuery } from "../src/db/index.js";

async function main() {
  const whatsappNumber = process.env.TEST_WHATSAPP_NUMBER || "+918892190816";
  const societyId = process.env.TEST_SOCIETY_ID || 1;
  const role = process.env.TEST_USER_ROLE || "OWNER";
  const name = process.env.TEST_USER_NAME || null;
  const apartment = process.env.TEST_USER_APARTMENT || null;

  const res = await dbQuery(
    `INSERT INTO users (whatsapp_number, society_id, role, name, apartment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (whatsapp_number) DO UPDATE SET society_id = EXCLUDED.society_id, role = EXCLUDED.role, name = COALESCE(EXCLUDED.name, users.name), apartment = COALESCE(EXCLUDED.apartment, users.apartment)
     RETURNING *`,
    [whatsappNumber, societyId, role, name, apartment],
  );

  console.log("Inserted/updated user:", res.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
