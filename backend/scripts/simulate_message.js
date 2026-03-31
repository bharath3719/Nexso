/*
  Simulate sending a WhatsApp-like webhook payload to the backend.
  Usage examples:
    npm run simulate:msg -- --from +911234567891 --text "Electrical outage on floor 3"
    npm run simulate:msg -- --from +911234567891 --image https://example.com/photo.jpg
    npm run simulate:msg -- --from +911234567891 --type text --text "Plumbing leak in kitchen"

  Env:
    API_BASE (default http://localhost:3000)
*/

const apiBase = process.env.API_BASE || "http://localhost:3000";

function parseArgs() {
  const out = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}
function defaultId() {
  return `msg-${Date.now()}`;
}

async function main() {
  const args = parseArgs();
  const from = args.from || "+911234567891";
  const id = args.id || defaultId();
  const timestamp = args.timestamp || nowIso();

  let payload;
  if (args.image) {
    payload = {
      id,
      from,
      timestamp,
      image: { url: args.image },
    };
  } else {
    const type = args.type || "text";
    const text = args.text || "Test message from simulator";
    payload = {
      id,
      from,
      timestamp,
      type,
      text,
    };
  }

  const res = await fetch(`${apiBase}/webhook/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
