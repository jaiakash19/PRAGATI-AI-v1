ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS precedent_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS proposal_decision_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('Decision','Sanction','Observation','Modification','Outcome')),
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  reference_number TEXT,
  amount NUMERIC(14,2),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposal_decision_records_proposal_idx
  ON proposal_decision_records(proposal_id, created_at DESC);