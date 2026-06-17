-- Employee self-service portal: personal todos and settings.

CREATE TABLE IF NOT EXISTS employee_todos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_todos_tenant_idx ON employee_todos (tenant_id);
CREATE INDEX IF NOT EXISTS employee_todos_employee_idx ON employee_todos (employee_id, completed, due_date);

CREATE TABLE IF NOT EXISTS employee_settings (
  employee_id TEXT PRIMARY KEY REFERENCES hr_employees(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_settings_tenant_idx ON employee_settings (tenant_id);

ALTER TABLE employee_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;

DROP POLICY IF EXISTS employee_todos_policy ON employee_todos;
CREATE POLICY employee_todos_policy ON employee_todos
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS employee_settings_policy ON employee_settings;
CREATE POLICY employee_settings_policy ON employee_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
