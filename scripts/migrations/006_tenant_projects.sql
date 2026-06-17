-- Client projects under a workspace (tenant). CEO sees all; employees see assigned projects.

CREATE TABLE IF NOT EXISTS tenant_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  github_repos JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS tenant_projects_tenant_idx ON tenant_projects (tenant_id);

CREATE TABLE IF NOT EXISTS user_project_assignments (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS user_project_assignments_user_idx ON user_project_assignments (user_id);

-- Fallback when projects are not split yet: CEO verifies repos to ingest org-wide.
CREATE TABLE IF NOT EXISTS tenant_github_scope (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  selected_repos JSONB NOT NULL DEFAULT '[]',
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_github_scope ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_project_assignments_policy ON user_project_assignments;
CREATE POLICY user_project_assignments_policy ON user_project_assignments
  USING (
    project_id IN (
      SELECT id FROM tenant_projects
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM tenant_projects
      WHERE tenant_id = current_setting('app.current_tenant_id', true)
    )
  );

DROP POLICY IF EXISTS tenant_projects_policy ON tenant_projects;
CREATE POLICY tenant_projects_policy ON tenant_projects
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_github_scope_policy ON tenant_github_scope;
CREATE POLICY tenant_github_scope_policy ON tenant_github_scope
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
