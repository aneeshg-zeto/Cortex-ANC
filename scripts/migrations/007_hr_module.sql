-- HR module: employees, payroll, payslips, leave, emergency notices, external plugins.

CREATE TABLE IF NOT EXISTS hr_employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  join_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  salary_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  emergency_contact JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_code),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS hr_employees_tenant_idx ON hr_employees (tenant_id);

CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_net NUMERIC(14, 2) NOT NULL DEFAULT 0,
  employee_count INT NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_payroll_runs_tenant_idx ON hr_payroll_runs (tenant_id, period_start DESC);

CREATE TABLE IF NOT EXISTS hr_payslips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  payroll_run_id TEXT REFERENCES hr_payroll_runs(id) ON DELETE SET NULL,
  period_label TEXT NOT NULL,
  gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions JSONB NOT NULL DEFAULT '[]',
  net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_payslips_tenant_idx ON hr_payslips (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hr_payslips_employee_idx ON hr_payslips (employee_id);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(4, 1) NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_leave_requests_tenant_idx ON hr_leave_requests (tenant_id, status);

CREATE TABLE IF NOT EXISTS hr_emergency_notices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  target_scope TEXT NOT NULL DEFAULT 'all',
  published_by TEXT,
  acknowledged_by JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_emergency_notices_tenant_idx ON hr_emergency_notices (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hr_plugin_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config JSONB NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, plugin_id)
);

ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_emergency_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_plugin_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_employees_policy ON hr_employees;
CREATE POLICY hr_employees_policy ON hr_employees
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS hr_payroll_runs_policy ON hr_payroll_runs;
CREATE POLICY hr_payroll_runs_policy ON hr_payroll_runs
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS hr_payslips_policy ON hr_payslips;
CREATE POLICY hr_payslips_policy ON hr_payslips
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS hr_leave_requests_policy ON hr_leave_requests;
CREATE POLICY hr_leave_requests_policy ON hr_leave_requests
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS hr_emergency_notices_policy ON hr_emergency_notices;
CREATE POLICY hr_emergency_notices_policy ON hr_emergency_notices
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS hr_plugin_connections_policy ON hr_plugin_connections;
CREATE POLICY hr_plugin_connections_policy ON hr_plugin_connections
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
