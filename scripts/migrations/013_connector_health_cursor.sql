-- Ingestion sync cursor per connector (used by ingest-runner)

ALTER TABLE connector_health
  ADD COLUMN IF NOT EXISTS cursor_value text NOT NULL DEFAULT '';
