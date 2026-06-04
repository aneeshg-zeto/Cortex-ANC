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
SQL

echo "✅ cortex_documents table ready"
