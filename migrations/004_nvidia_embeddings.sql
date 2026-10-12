-- NVIDIA Nemotron embedding vectors. JSONB allows the hosted model's 2048 dimensions
-- without an extension dependency. Only the server-side API writes or searches these vectors.
CREATE TABLE IF NOT EXISTS proposal_embeddings_nvidia (
  proposal_id TEXT PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
  embedding_json JSONB NOT NULL,
  model TEXT NOT NULL DEFAULT 'nvidia/nemotron-3-embed-1b',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proposal_embeddings_nvidia_updated_idx
  ON proposal_embeddings_nvidia(updated_at DESC);