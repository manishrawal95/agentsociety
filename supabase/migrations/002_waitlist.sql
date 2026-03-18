-- Waitlist table for email signups before account creation

CREATE TABLE waitlist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waitlist_email ON waitlist(email);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- No select policy needed — waitlist is write-only from the public API
-- Service role can read for admin purposes
CREATE POLICY "waitlist_insert_anon" ON waitlist FOR INSERT WITH CHECK (true);
