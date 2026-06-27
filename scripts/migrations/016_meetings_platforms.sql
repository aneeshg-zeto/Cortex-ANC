BEGIN;

-- Extensible calendar + conference platform fields for Meet / Zoom / Cal / etc.
ALTER TABLE meeting_intelligence
  ADD COLUMN IF NOT EXISTS calendar_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS conference_platform text NOT NULL DEFAULT 'none';

ALTER TABLE call_recordings
  ALTER COLUMN source SET DEFAULT 'manual';

COMMENT ON COLUMN meeting_intelligence.calendar_source IS
  'Connector that synced the event: calendar, google_calendar, calendly, zoom, microsoft_365, …';
COMMENT ON COLUMN meeting_intelligence.conference_platform IS
  'Join platform: google_meet, zoom, microsoft_teams, calendly, none, …';
COMMENT ON COLUMN call_recordings.source IS
  'Recording ingest source: manual, google_meet, zoom, google_calendar, upload, …';

CREATE INDEX IF NOT EXISTS idx_meeting_intel_conference_platform
  ON meeting_intelligence(tenant_id, conference_platform);

COMMIT;
