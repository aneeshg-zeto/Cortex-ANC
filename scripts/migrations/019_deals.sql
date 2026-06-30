-- F2: Sales pipeline
BEGIN;

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  name text NOT NULL DEFAULT 'Untitled deal',
  stage text NOT NULL DEFAULT 'lead',
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  probability numeric(5, 2) NOT NULL DEFAULT 0,
  close_date date,
  owner text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_stage ON deals (tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals (tenant_id, close_date);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_deals ON deals;
CREATE POLICY tenant_deals ON deals
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
