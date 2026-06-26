-- DEPLOY INSTRUCTIONS:
-- Step 1: bun run db:migrate  (runs 012_unified_documents.sql in transaction)
-- Step 2: psql $DATABASE_URL -f scripts/migrations/012_indexes.sql
--         (runs CONCURRENTLY — no downtime, can take minutes on large tables)
-- Do NOT include these indexes in bun run db:migrate automation.

-- Run AFTER 012_unified_documents.sql is committed.
-- CONCURRENTLY means zero downtime — no table lock.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cortex_docs_acl_visibility
  ON cortex_documents USING gin(acl);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cortex_docs_content_hash
  ON cortex_documents(tenant_id, content_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cortex_docs_source_id
  ON cortex_documents(tenant_id, source_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cortex_docs_entity_refs
  ON cortex_documents USING gin(entity_refs);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cortex_docs_doc_type
  ON cortex_documents(tenant_id, document_type);
