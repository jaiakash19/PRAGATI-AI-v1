CREATE TABLE IF NOT EXISTS station_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  sender_station_code TEXT NOT NULL REFERENCES police_stations(station_code),
  recipient_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_station_code TEXT NOT NULL REFERENCES police_stations(station_code),
  message_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending','delivered','rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS station_messages_sender_idx ON station_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS station_messages_recipient_idx ON station_messages(recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS station_messages_approval_idx ON station_messages(recipient_station_code, status, created_at DESC);