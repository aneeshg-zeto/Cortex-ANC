-- F20: Morning digest + push subscriptions
BEGIN;

CREATE TABLE IF NOT EXISTS digest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_status jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_digest_runs_tenant ON digest_runs (tenant_id, sent_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  endpoint text NOT NULL,
  keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_tenant_user ON push_subscriptions (tenant_id, user_id);

ALTER TABLE digest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_digest_runs ON digest_runs;
CREATE POLICY tenant_digest_runs ON digest_runs
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_push_subscriptions ON push_subscriptions;
CREATE POLICY tenant_push_subscriptions ON push_subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
