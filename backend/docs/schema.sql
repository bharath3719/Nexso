-- Minimal normalized schema for Nexso backend

CREATE TABLE IF NOT EXISTS societies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','SOCIETY_ADMIN','VENDOR')),
  society_id INTEGER REFERENCES societies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp_number TEXT UNIQUE,
  society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  categories TEXT[] NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT UNIQUE,
  society_id INTEGER REFERENCES societies(id) ON DELETE CASCADE,
  raised_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT,
  media_urls TEXT[],
  priority TEXT DEFAULT 'NORMAL',
  status TEXT NOT NULL CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_activity_logs (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE,
  sender_whatsapp_number TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  message_type TEXT NOT NULL,
  raw_message_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
