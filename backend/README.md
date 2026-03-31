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
- Database Schema (minimal SQL): see [docs/schema.sql](docs/schema.sql)

## Environment

- macOS or Linux recommended
- Postgres 13+

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

## Next Steps

- Configure `DATABASE_URL` and run SQL in [docs/schema.sql](docs/schema.sql).
- Replace notification stub with actual WhatsApp Business provider.
- Flesh out role-based transitions and admin flows.
