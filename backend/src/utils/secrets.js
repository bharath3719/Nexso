/**
 * utils/secrets.js
 * ────────────────
 * Single source for the JWT signing secret.
 *
 * The dev fallback is deliberately kept for local work, but it must never be
 * reachable in production: a known signing key lets anyone mint a
 * NEXSO_ADMIN token. `assertProductionSecrets()` is called at boot so a
 * misconfigured deploy fails immediately instead of silently accepting
 * forged tokens.
 */

const DEV_JWT_SECRET = "nexso-dev-secret";

export function jwtSecret() {
  return process.env.JWT_SECRET || DEV_JWT_SECRET;
}

/**
 * Key for the HMAC that names bill PDF files (see services/billPdf.js).
 *
 * Deliberately separate from jwtSecret(). Bill URLs are long-lived — they go to
 * residents over WhatsApp and stay in their chat history for months — whereas
 * JWT_SECRET is a credential you may need to rotate at short notice. Deriving
 * filenames from the JWT secret meant any rotation silently renamed every bill
 * and 404'd every link already sent.
 *
 * Falls back to the JWT secret so deploys that never set this keep resolving
 * the URLs they have already issued.
 */
export function billUrlSecret() {
  return process.env.BILL_URL_SECRET || jwtSecret();
}

/**
 * Throws when a production deploy is missing hard security requirements.
 *
 * The hard failure is gated on NODE_ENV=production, but the dev-key warning
 * below is not: a host that forgets to set NODE_ENV would otherwise skip this
 * check entirely and serve real traffic signed with the public dev key.
 */
export function assertProductionSecrets() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET) {
    console.warn(
      "\n" +
      "  ****************************************************************\n" +
      "  *  WARNING: signing JWTs with the PUBLIC dev key.              *\n" +
      "  *  Anyone can forge an admin token. Set JWT_SECRET before      *\n" +
      "  *  exposing this server to real traffic.                       *\n" +
      "  *      openssl rand -base64 32                                 *\n" +
      "  ****************************************************************\n",
    );
  }

  if (process.env.NODE_ENV !== "production") return;

  const problems = [];

  if (!process.env.JWT_SECRET) {
    problems.push("JWT_SECRET is not set — tokens would be signed with the public dev key.");
  } else if (process.env.JWT_SECRET === DEV_JWT_SECRET) {
    problems.push("JWT_SECRET is set to the public dev value.");
  } else if (process.env.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET is shorter than 32 characters.");
  }

  if (!process.env.WHATSAPP_APP_SECRET) {
    problems.push("WHATSAPP_APP_SECRET is not set — inbound webhooks would skip signature checks.");
  }

  if (problems.length) {
    throw new Error(
      `Refusing to start in production:\n  - ${problems.join("\n  - ")}`,
    );
  }
}
