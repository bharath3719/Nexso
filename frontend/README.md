# Nexso Frontend (Message Simulator)

A tiny Vite + React app to simulate sending WhatsApp-like payloads to the Nexso backend webhook.

## Configure

- Backend base URL defaults to `http://localhost:3000`.
- Optionally set `VITE_API_BASE` in `.env.local` to override.

## Run

```bash
npm install
npm run dev
```

Open the printed local URL (default: http://localhost:5173).

## Usage

- Choose message type (Text or Image)
- Edit prefilled fields as needed
- Click "Send Message" to POST to `/webhook/whatsapp` on the backend.
- Response JSON is rendered below the form.
