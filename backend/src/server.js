import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { isDbConnected } from "./db/index.js";
import { startMaintenanceScheduler } from "./services/maintenanceScheduler.js";
import { startTicketEscalationScheduler } from "./services/ticketEscalationScheduler.js";

import webhookRouter    from "./routes/webhook.js";
import vendorRouter     from "./routes/vendor.js";
import ticketsRouter    from "./routes/tickets.js";
import usersRouter      from "./routes/users.js";
import societiesRouter  from "./routes/societies.js";
import onboardingRouter from "./routes/onboarding.js";
import authRouter       from "./routes/auth.js";
import secretaryRouter     from "./routes/secretary.js";
import vendorPortalRouter  from "./routes/vendor-portal.js";
import maintenanceRouter      from "./routes/maintenance.js";
import razorpayWebhookRouter from "./routes/razorpayWebhook.js";
import residentRouter        from "./routes/resident.js";
import guardRouter           from "./routes/guard.js";
import passesRouter          from "./routes/passes.js";

const app = express();

function getOriginMatchValues(value) {
  const trimmed = (value || "").trim().replace(/\/+$/, "");

  if (!trimmed) return [];

  try {
    const url = new URL(trimmed);
    return [url.origin, url.host];
  } catch {
    const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
    const host = withoutProtocol.split("/")[0];
    return host ? [trimmed, host] : [trimmed];
  }
}

const corsOrigins = new Set(
  (process.env.CORS_ORIGIN || "")
    .split(",")
    .flatMap((value) => getOriginMatchValues(value))
    .filter(Boolean),
);

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(helmet({
  // Allow inline scripts/styles that Vite dev server and Fluent UI use in production builds
  contentSecurityPolicy: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 login attempts per window per IP
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: "too_many_requests" },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // Meta sends batched messages; 100/min is generous
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: "too_many_requests" },
});

app.use(
  cors(
    corsOrigins.size
      ? {
          origin(origin, callback) {
            if (!origin || getOriginMatchValues(origin).some((value) => corsOrigins.has(value))) {
              callback(null, true);
              return;
            }
            callback(new Error("CORS origin not allowed"));
          },
        }
      : undefined,
  ),
);
// Capture raw body for signature verification while still parsing JSON
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(morgan("dev"));

// Serve generated maintenance bill PDFs
app.use("/bills", express.static(path.join(__dirname, "..", "bills")));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    db: isDbConnected() ? "connected" : "disconnected",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// More-specific webhook mounts must come before the general /webhook catch-all
app.use("/webhook/razorpay",  razorpayWebhookRouter);
app.use("/webhook",           webhookLimiter, webhookRouter);

app.use("/api/auth",         authLimiter, authRouter);
app.use("/api/secretary",    secretaryRouter);
app.use("/api/vendor-portal", vendorPortalRouter);
app.use("/api/vendors",      vendorRouter);
app.use("/api/tickets",      ticketsRouter);
app.use("/api/users",        usersRouter);
app.use("/api/societies",    societiesRouter);
app.use("/api/onboarding",   onboardingRouter);
app.use("/api/maintenance",  maintenanceRouter);
app.use("/api/resident",     residentRouter);
app.use("/api/guard",        guardRouter);
app.use("/api/passes",       passesRouter);

// ── Background scheduler ──────────────────────────────────────────────────────
// Only start in production / when the DB is (or will be) available.
// Skipped during test runs where NODE_ENV=test.
if (process.env.NODE_ENV !== "test") {
  startMaintenanceScheduler();
  startTicketEscalationScheduler();
}

// ── Frontend static serving ───────────────────────────────────────────────────
// Serve the Vite production build and fall back to index.html for all
// client-side routes so hard-refreshes don't return 404.
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

export default app;
