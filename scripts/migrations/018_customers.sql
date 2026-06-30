-- F1: Customer & Revenue module
BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  name text NOT NULL,
  email text,
  domain text,
  mrr numeric(14, 2) NOT NULL DEFAULT 0,
  arr numeric(14, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  health_score int NOT NULL DEFAULT 50,
  churn_risk text NOT NULL DEFAULT 'unknown',
  last_contact timestamptz,
  owner text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_health ON customers (tenant_id, health_score);
CREATE INDEX IF NOT EXISTS idx_customers_risk ON customers (tenant_id, churn_risk);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_customers ON customers;
CREATE POLICY tenant_customers ON customers
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
