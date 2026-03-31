import dotenv from "dotenv";
dotenv.config();

import app from "./server.js";
import { ensureSchema } from "./db/index.js";

const port = process.env.PORT || 3000;

(async () => {
  try {
    await ensureSchema();
  } catch (e) {
    console.error("Failed to ensure DB schema:", e);
  }
  app.listen(port, () => {
    console.log(`Nexso backend listening on http://localhost:${port}`);
  });
})();
