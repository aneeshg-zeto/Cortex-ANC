-- F10: Native OKR module
BEGIN;

CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id text,
  owner_name text,
  title text NOT NULL,
  description text,
  level text NOT NULL DEFAULT 'company',
  period text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES objectives(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'on_track',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title text NOT NULL,
  target numeric(16, 2) NOT NULL DEFAULT 0,
  current numeric(16, 2) NOT NULL DEFAULT 0,
  start_value numeric(16, 2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  due_date date,
  source_link text,
  source_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objectives_tenant ON objectives (tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives (parent_id);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results (objective_id);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_objectives ON objectives;
CREATE POLICY tenant_objectives ON objectives
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_key_results ON key_results;
CREATE POLICY tenant_key_results ON key_results
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
