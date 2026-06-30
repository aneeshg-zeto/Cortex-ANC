-- F9: Decision log full-text search + links
BEGIN;

ALTER TABLE decision_logs
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_decision_logs_tsv ON decision_logs USING gin (search_tsv);

COMMIT;
