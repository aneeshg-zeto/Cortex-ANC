-- Panel decision log + HR emergency notice read tracking

CREATE TABLE IF NOT EXISTS decision_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_refs JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_logs_tenant_idx ON decision_logs (tenant_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS hr_emergency_notice_reads (
  notice_id TEXT NOT NULL REFERENCES hr_emergency_notices(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notice_id, employee_id)
);

CREATE INDEX IF NOT EXISTS hr_notice_reads_tenant_idx ON hr_emergency_notice_reads (tenant_id);

ALTER TABLE decision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_emergency_notice_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_decision_logs ON decision_logs;
CREATE POLICY tenant_decision_logs ON decision_logs
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_notice_reads ON hr_emergency_notice_reads;
CREATE POLICY tenant_notice_reads ON hr_emergency_notice_reads
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
