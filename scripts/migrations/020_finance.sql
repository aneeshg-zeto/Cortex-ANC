-- F3: Native finance module
BEGIN;

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  amount numeric(16, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  direction text NOT NULL DEFAULT 'debit',
  category text NOT NULL DEFAULT 'uncategorized',
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  account text,
  vendor text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions (tenant_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (tenant_id, category);

-- Optional opening balance per account (used to derive cash balance)
CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  opening_balance numeric(16, 2) NOT NULL DEFAULT 0,
  current_balance numeric(16, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, name)
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_transactions ON transactions;
CREATE POLICY tenant_transactions ON transactions
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_finance_accounts ON finance_accounts;
CREATE POLICY tenant_finance_accounts ON finance_accounts
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
