-- Fix Studio RLS policies: use app.current_tenant_id (matches tenant-pool.ts)

DROP POLICY IF EXISTS tenant_user_layouts ON user_layouts;
CREATE POLICY tenant_user_layouts ON user_layouts
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_workflows ON workflows;
CREATE POLICY tenant_workflows ON workflows
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_studio_notebooks ON studio_notebooks;
CREATE POLICY tenant_studio_notebooks ON studio_notebooks
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_active_presence ON active_presence;
CREATE POLICY tenant_active_presence ON active_presence
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
