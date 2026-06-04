# Cortex Platform

**Cortex** is the Single Brain for Your Entire Business — an AI-native company platform that connects every tool a business runs on into one intelligent system.

Phase 0 + Phase 1 groundwork: integration connectors (from Activepieces), vector RAG brain, Executive Desk, and Clients Desk.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16.2, React 19, Tailwind v4, shadcn/ui v4 + `@cortex/ui` (from Activepieces) |
| Monorepo | Bun workspaces + Turborepo |
| Brain | `@cortex/graph-core` — pgvector + in-memory fallback |
| Agent | `@cortex/agent-core` — RAG + Groq/Ollama |
| Integrations | `@cortex/integration-core` — Slack, Gmail, GitHub, Linear, Notion |

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Ollama](https://ollama.com) (for local LLM + embeddings) **or** Groq API key
- [Docker](https://docker.com) (optional, for PostgreSQL + pgvector)

### Pull embedding model (first run)

```bash
ollama pull nomic-embed-text
ollama pull llama3:8b   # if using local chat model
```

## Quick Start

```bash
cd cortex-platform
cp .env.example .env   # lives at monorepo root; loaded into Next.js via apps/web/next.config.ts
# Set GROQ_API_KEY and LLM_PROVIDER=groq (or use Ollama with LLM_PROVIDER=ollama)

bun install
bun run build

# Optional: PostgreSQL + pgvector
bun run db:up
bun run db:init
bun run seed

bun dev
```

### Desks

| URL | Purpose |
| --- | --- |
| http://localhost:3000/executive-desk | Slack-style exec chat with source citations |
| http://localhost:3000/clients-desk | Email-style client reply drafting + HITL approve |
| http://localhost:3000/chat | Simple brain chat |

### Demo queries

**Executive Desk:** `What is the status of the Acme project?`

Expected: answer citing Linear ticket ACME-142 (blocked on API keys), Slack standup, GitHub PR #88.

**Clients Desk:** Select Sarah Chen's email → **Reply with AI** → draft mentions launch timeline/blockers → **Approve & Send** logs to console.

## Environment Variables

```bash
LLM_PROVIDER=groq          # groq | ollama (auto-detected from keys)
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
LOCAL_LLM_ENDPOINT=http://localhost:11434
LOCAL_LLM_MODEL=llama3:8b
EMBEDDING_MODEL=nomic-embed-text
DATABASE_URL=postgresql://cortex:cortex@localhost:5434/cortex
```

**LLM priority:** `LLM_PROVIDER` → `GROQ_API_KEY` present → Ollama fallback.

Without `DATABASE_URL`, the vector store uses in-memory mode (auto-seeded on first query).

## Monorepo Structure

```text
cortex-platform/
├── apps/web/                    # Next.js — desks + API routes
├── packages/
│   ├── ui/                      # Chat UI adapted from Activepieces prompt-kit
│   ├── shared/                  # HTTP, LLM, embeddings
│   ├── agent-core/              # askQuestion, draftClientReply, RAG
│   ├── graph-core/              # pgvector + memory vector store
│   └── integration-core/        # Connectors (Activepieces adapted)
├── services/
│   ├── event-consumer/          # Mock hub documents
│   └── ingestion-service/       # Slack spoke (live ingest if token set)
├── scripts/seed-data.ts
└── docker-compose.yml           # PostgreSQL + pgvector
```

## Hub-Spoke Model

- **Hub:** vector store (`graph-core`) — documents indexed with embeddings
- **Spokes:** connectors (Slack, Gmail, …) push data via ingestion scripts
- **Mock spoke:** `services/ingestion-service/src/spokes/slack-spoke.ts`
- **Seed spoke:** `bun run seed` loads 12 mock docs (Linear, Slack, GitHub, Gmail, Notion)

Kafka/Temporal are **not** implemented yet — ingestion is manual/seed-based.

## API Routes

| Route | Body | Response |
| --- | --- | --- |
| `POST /api/executive-ask` | `{ question }` | `{ answer, sources[] }` |
| `POST /api/client-reply` | `{ emailContent, subject? }` | `{ draft, sources[] }` |
| `POST /api/chat` | `{ prompt }` | `{ answer, sources[] }` |

## Activepieces UI Reuse

Copied and adapted from `activepieces-main/packages/web/src/components/`:

| Cortex component | Activepieces source |
| --- | --- |
| `Spinner` | `custom/spinner.tsx` |
| `Markdown` | `prompt-kit/markdown.tsx` (simplified) |
| `ChatMessage*` | `prompt-kit/message.tsx` |
| `ChatWindow` | `prompt-kit/chat-container.tsx` |
| `ChatInput` | `prompt-kit/prompt-input.tsx` (simplified) |
| `Panel*` | `ui/resizable-panel.tsx` |

Not reused: `CopyButton`, `Source` link chips, full `ApMarkdown` variants — minimal replacements in `@cortex/ui`.

## Scripts

```bash
bun dev              # Start web + watch packages
bun run build        # Build all packages
bun run seed         # Seed vector store
bun run db:up        # Start PostgreSQL
bun run smoke:slack  # Slack connector smoke test
```
