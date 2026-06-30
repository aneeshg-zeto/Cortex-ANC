-- F7: Competitive & market signals
BEGIN;

CREATE TABLE IF NOT EXISTS competitive_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competitor text NOT NULL,
  signal_type text NOT NULL,
  value text,
  numeric_value numeric(16, 4),
  source_url text,
  diff_from_last text,
  is_alert boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_competitive_tenant ON competitive_signals (tenant_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_competitive_competitor ON competitive_signals (tenant_id, competitor, signal_type);

ALTER TABLE competitive_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_competitive_signals ON competitive_signals;
CREATE POLICY tenant_competitive_signals ON competitive_signals
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
