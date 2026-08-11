import dotenv from "dotenv";
dotenv.config();

import app from "./server.js";
import { ensureSchema } from "./db/index.js";
import { assertProductionSecrets } from "./utils/secrets.js";

const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

// A crash is better than a zombie process serving 500s on every request.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

(async () => {
  try {
    assertProductionSecrets();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  let schemaOk = false;
  try {
    schemaOk = await ensureSchema();
  } catch (e) {
    console.error("Failed to ensure DB schema:", e);
  }

  // ensureSchema swallows its own errors and returns false. Booting anyway in
  // production just means every request fails with a 500 instead.
  if (!schemaOk && isProd) {
    console.error("Refusing to start in production without a usable database schema.");
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Nexso backend listening on http://localhost:${port}`);
  });
})();
