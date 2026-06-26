-- Radar alerts: proactive notifications for stale issues, sentiment drops, etc.

CREATE TABLE IF NOT EXISTS radar_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('stale_issue', 'sentiment_drop', 'budget_anomaly', 'retention_risk', 'general')),
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_alerts_tenant
  ON radar_alerts (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_radar_alerts_unread
  ON radar_alerts (tenant_id, read)
  WHERE read = false;
