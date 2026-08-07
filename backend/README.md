# Nexso Backend (Express + Postgres)

Event-driven backend to convert WhatsApp messages into structured, auditable service tickets and route them to vendors.

## Quick Start

1. Create `.env` from `.env.example` and set `DATABASE_URL`.
2. Install dependencies and run the server.

```bash
npm install
npm run dev
```

- Health check: `GET /health` → `{ status: "ok" }`
- WhatsApp webhook: `POST /webhook/whatsapp`

## Environment

Copy [backend/.env.example](backend/.env.example) to `.env` and set values for your target environment.

- `DATABASE_URL`: required for production persistence.
- `PORT`: backend port, defaults to `3000`.
- `CORS_ORIGIN`: comma-separated frontend origins allowed to call the API.
- `TRUST_PROXY`: set to `true` behind a reverse proxy.
- `WHATSAPP_VERIFY_TOKEN`: required for Meta webhook verification.
- `WHATSAPP_APP_SECRET`: required for signature validation.
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_FLOW_TEMPLATE_NAME`: required if the app should send outbound WhatsApp replies/templates.

## Core Responsibilities

- Ingest WhatsApp messages via webhook, store raw payloads with idempotency.
- Resolve sender identity and role across tenants/societies.
- Detect intent (create/update/other) via keyword/menu.
- Create and manage tickets with deduplication and permissions.
- Vendor matching and assignment rules.
- Dispatch vendor notifications with delivery logs.
- Enforce ticket lifecycle via role-based state machine.
- Thread all messages and activity logs for auditability.

## Diagrams

- Ticket State Machine: see [docs/state_machine.mmd](docs/state_machine.mmd)
- Webhook → Ticket Sequence: see [docs/sequence_webhook_ticket.mmd](docs/sequence_webhook_ticket.mmd)
- Database Schema: defined in code by `ensureSchema()` in [src/db/index.js](src/db/index.js); apply with `npm run db:schema`

## Deployment

1. Provision Postgres and set `DATABASE_URL`.
2. Set `NODE_ENV=production`, `JWT_SECRET` and `WHATSAPP_APP_SECRET` — the server
   refuses to start in production without them.
3. Set `CORS_ORIGIN` to your deployed frontend origin.
4. Apply the schema with `npm run db:schema`.
5. Create the first admin with `npm run db:seed-admin` (prints a generated password once).
6. Start the API with `npm start`.
7. Confirm the `/health` endpoint in [src/server.js](src/server.js) returns `status: ok`.

See [RUNBOOK-GOLIVE.md](../RUNBOOK-GOLIVE.md) for backup, cleanup and recovery.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` / `npm run dev` | Run the API |
| `npm run db:schema` | Apply the schema (`ensureSchema()`) |
| `npm run db:seed-admin` | Create or reset the NEXSO_ADMIN account |
| `npm run db:backup` | Verified snapshot + row-count manifest |
| `npm run db:restore` | Restore a dump (`--into` to rehearse safely) |
| `npm run db:cleanup` | Delete test societies (dry run by default) |
| `npm run db:reset` | **Dev only** — drop everything and rebuild |
| `npm run simulate:msg` | Post a fake WhatsApp webhook locally |

## Runtime Notes

- macOS or Linux recommended
- Postgres 13+
- The `/health` endpoint reports API status plus database connectivity state.

## Notes

- The DB layer starts with a safe fallback; app will run without DB but persistence features are inactive.
- Signature verification is stubbed; plug your provider's HMAC routine into `verifySignature()`.

## Try It (without DB)

```bash
npm install
npm run dev
# In another terminal:
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H 'Content-Type: application/json' \
  -d '{"message_id":"msg_1","sender_whatsapp_number":"+15551234567","timestamp": "2026-01-31T10:00:00Z","message_type":"text","text":"Raise Service Request: plumbing leak"}'
```

You should get a JSON response confirming ingestion and intent.

## Production Caveats

- The backend is ready to run in production-like environments, but WhatsApp outbound sending only works when the Meta credentials are configured.
- If you need real admin authentication for the dashboard, add proper server-side auth or place the frontend behind your hosting provider's access control.
