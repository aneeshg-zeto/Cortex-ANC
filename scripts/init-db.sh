#!/usr/bin/env bash
set -euo pipefail

psql "${DATABASE_URL:-postgresql://cortex:cortex@localhost:5434/cortex}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS cortex_documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cortex_documents_embedding_idx
  ON cortex_documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS cortex_nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES cortex_nodes(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES cortex_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cortex_nodes_label_idx ON cortex_nodes (label);
CREATE INDEX IF NOT EXISTS cortex_edges_from_idx ON cortex_edges (from_id);

CREATE TABLE IF NOT EXISTS cortex_approvals (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  connector TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT,
  decided_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cortex_agent_interactions (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  answer TEXT,
  success BOOLEAN,
  feedback TEXT,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_logs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  answer TEXT,
  verdict TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

echo "✅ cortex_documents table ready"
