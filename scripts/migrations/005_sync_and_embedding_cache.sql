-- Incremental sync cursor per connected account
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Cache embeddings by content hash to skip re-embedding unchanged chunks
CREATE TABLE IF NOT EXISTS embedding_cache (
  content_hash TEXT PRIMARY KEY,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embedding_cache_created_at_idx
  ON embedding_cache (created_at);
