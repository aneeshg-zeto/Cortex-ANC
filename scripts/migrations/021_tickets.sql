-- F4: Support / helpdesk
BEGIN;

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '(no subject)',
  body text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assignee text,
  requester_email text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cluster_id text,
  cluster_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON tickets (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_cluster ON tickets (tenant_id, cluster_id);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_tickets ON tickets;
CREATE POLICY tenant_tickets ON tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;
