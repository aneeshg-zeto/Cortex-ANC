-- Studio: dashboard layouts, workflows, notebooks, presence

CREATE TABLE IF NOT EXISTS user_layouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  layout_key TEXT NOT NULL DEFAULT 'dashboard',
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, layout_key)
);

CREATE INDEX IF NOT EXISTS user_layouts_tenant_idx ON user_layouts (tenant_id);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflows_tenant_idx ON workflows (tenant_id);

CREATE TABLE IF NOT EXISTS studio_notebooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled notebook',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_notebooks_tenant_idx ON studio_notebooks (tenant_id);

CREATE TABLE IF NOT EXISTS active_presence (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  page TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  cursor_x REAL NOT NULL DEFAULT 0,
  cursor_y REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#14b8a6',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id, page)
);

CREATE INDEX IF NOT EXISTS active_presence_page_idx ON active_presence (tenant_id, page, last_seen);

ALTER TABLE user_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_user_layouts ON user_layouts;
CREATE POLICY tenant_user_layouts ON user_layouts
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_workflows ON workflows;
CREATE POLICY tenant_workflows ON workflows
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_studio_notebooks ON studio_notebooks;
CREATE POLICY tenant_studio_notebooks ON studio_notebooks
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_active_presence ON active_presence;
CREATE POLICY tenant_active_presence ON active_presence
  USING (tenant_id = current_setting('app.tenant_id', true));
