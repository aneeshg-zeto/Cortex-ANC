#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load monorepo .env when DATABASE_URL is not exported (e.g. npm run db:migrate)
if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Local default matches docker-compose postgres (port 5434)
URL="${DATABASE_URL:-postgresql://cortex:cortex@localhost:5434/cortex}"

if [[ "$URL" == *'${{'* ]]; then
  echo "ERROR: DATABASE_URL looks like a Railway template (${URL})."
  echo "  For local migrate, use cortex-platform/.env:"
  echo "  DATABASE_URL=postgresql://cortex:cortex@localhost:5434/cortex"
  echo "  (.env.deployment is for Railway only — do not source it locally.)"
  exit 1
fi

echo "→ Running Cortex database migrations…"
echo "  · database: ${URL%%@*}@***"

for f in scripts/migrations/*.sql; do
  echo "  · $(basename "$f")"
  psql "$URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "✅ Migrations complete"
