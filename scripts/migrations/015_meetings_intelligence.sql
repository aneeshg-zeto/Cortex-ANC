BEGIN;

CREATE TABLE IF NOT EXISTS meeting_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  calendar_event_id text NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  location text,
  meeting_url text,
  status text NOT NULL DEFAULT 'upcoming',
  meeting_type text NOT NULL DEFAULT 'external',
  briefing_status text NOT NULL DEFAULT 'pending',
  organizer_email text,
  attendee_emails text[] NOT NULL DEFAULT '{}',
  attendee_count int NOT NULL DEFAULT 0,
  briefing_generated_at timestamptz,
  briefing jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome_notes text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_drafted_at timestamptz,
  follow_up_email_draft text,
  calendar_source text NOT NULL DEFAULT 'unknown',
  conference_platform text NOT NULL DEFAULT 'none',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, calendar_event_id)
);

CREATE TABLE IF NOT EXISTS meeting_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  meeting_id uuid NOT NULL REFERENCES meeting_intelligence(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  relevance_score numeric NOT NULL DEFAULT 0,
  relevance_reason text,
  document_type text,
  source text,
  title text,
  source_url text,
  snippet text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES meeting_intelligence(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  source_file_id text,
  recorded_at timestamptz,
  duration_seconds int,
  participants text[] DEFAULT '{}',
  transcript text,
  summary text,
  key_decisions jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  sentiment text,
  topics text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  company text,
  role_title text,
  linkedin_url text,
  first_interaction_at timestamptz,
  last_interaction_at timestamptz,
  total_meetings int DEFAULT 0,
  total_emails int DEFAULT 0,
  relationship_status text DEFAULT 'prospect',
  notes text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_meeting_intel_tenant_start
  ON meeting_intelligence(tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_meeting_intel_status
  ON meeting_intelligence(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_intel_attendees
  ON meeting_intelligence USING gin(attendee_emails);
CREATE INDEX IF NOT EXISTS idx_meeting_docs_meeting
  ON meeting_documents(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_docs_tenant_doc
  ON meeting_documents(tenant_id, document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_docs_meeting_doc
  ON meeting_documents(meeting_id, document_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_tenant
  ON call_recordings(tenant_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_meeting_contacts_tenant_email
  ON meeting_contacts(tenant_id, email);

ALTER TABLE meeting_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_meeting_intelligence ON meeting_intelligence;
CREATE POLICY tenant_meeting_intelligence ON meeting_intelligence
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_meeting_documents ON meeting_documents;
CREATE POLICY tenant_meeting_documents ON meeting_documents
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_call_recordings ON call_recordings;
CREATE POLICY tenant_call_recordings ON call_recordings
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_meeting_contacts ON meeting_contacts;
CREATE POLICY tenant_meeting_contacts ON meeting_contacts
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
