-- F6: Time & attention audit
BEGIN;

CREATE TABLE IF NOT EXISTS attention_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  subject_name text,
  week_start date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_attention_weekly_tenant ON attention_weekly (tenant_id, week_start);

ALTER TABLE attention_weekly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_attention_weekly ON attention_weekly;
CREATE POLICY tenant_attention_weekly ON attention_weekly
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
