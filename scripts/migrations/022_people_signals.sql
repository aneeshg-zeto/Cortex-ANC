-- F5: People intelligence (signals, not records)
BEGIN;

CREATE TABLE IF NOT EXISTS people_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  subject_name text,
  signal_type text NOT NULL,
  score numeric(6, 2) NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'normal',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_people_signals_tenant ON people_signals (tenant_id, signal_type);

ALTER TABLE people_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_people_signals ON people_signals;
CREATE POLICY tenant_people_signals ON people_signals
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
