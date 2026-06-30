-- F11: Hiring funnel
BEGIN;

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  name text NOT NULL,
  email text,
  role text,
  stage text NOT NULL DEFAULT 'applied',
  rating numeric(4, 2),
  applied_at timestamptz,
  last_activity timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_candidates_tenant_stage ON candidates (tenant_id, stage);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_candidates ON candidates;
CREATE POLICY tenant_candidates ON candidates
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
