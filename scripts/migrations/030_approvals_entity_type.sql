-- F14: Expand approvals to more entity types (expense, leave, contract, vendor, deal)
BEGIN;

ALTER TABLE cortex_approvals
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'action';

ALTER TABLE cortex_approvals
  ADD COLUMN IF NOT EXISTS tenant_id text;

ALTER TABLE cortex_approvals
  ADD COLUMN IF NOT EXISTS title text;

CREATE INDEX IF NOT EXISTS idx_cortex_approvals_entity ON cortex_approvals (entity_type, status);

COMMIT;
