-- F8: Investor / board module
BEGIN;

CREATE TABLE IF NOT EXISTS investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  fund text,
  stage text,
  status text NOT NULL DEFAULT 'prospect',
  ownership_pct numeric(6, 3) NOT NULL DEFAULT 0,
  amount_invested numeric(16, 2) NOT NULL DEFAULT 0,
  last_contact timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_investors_tenant ON investors (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_board_updates_tenant ON board_updates (tenant_id, generated_at);

ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_investors ON investors;
CREATE POLICY tenant_investors ON investors
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_board_updates ON board_updates;
CREATE POLICY tenant_board_updates ON board_updates
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
