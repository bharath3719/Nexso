import crypto from "crypto";

export const log = (...args) => console.log("[nexso]", ...args);

export const verifySignature = (signature, rawBody) => {
  // Meta sends X-Hub-Signature-256 as "sha256=<hex>" over the raw body using the app secret
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // allow local dev without secret
  if (!signature || !rawBody) return false;

  try {
    const normalizedSig = String(signature).startsWith("sha256=") ? String(signature).slice(7) : String(signature);

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(normalizedSig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (e) {
    log("Signature verification error", e);
    return false;
  }
};
