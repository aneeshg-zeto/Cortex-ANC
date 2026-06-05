# Cortex Platform

**Cortex** is the Single Brain for Your Entire Business — an AI-native company platform that connects every tool a business runs on into one intelligent system.

Phase 2.5: live infra hub-spoke, 700+ connectors, hybrid RAG brain, Temporal approvals, admin UI, LiteLLM gateway.

## Stack

| Layer           | Technology                                                         |
| --------------- | ------------------------------------------------------------------ |
| Frontend        | Next.js 16.2, React 19, Tailwind v4, Galvanite theme, `@cortex/ui` |
| Monorepo        | Bun workspaces + Turborepo                                         |
| Auth            | Clerk (optional), `@cortex/auth` + Permit.io stub                  |
| Brain           | `@cortex/agent-core` — `runBrain`, hybrid RAG, HITL write actions  |
| Graph + vectors | `@cortex/graph-core` — pgvector + Postgres knowledge graph         |
| LLM gateway     | LiteLLM → Groq (70B) / Ollama (8B)                                 |
| Integrations    | `@cortex/integration-core` — 706 adapted + 5 core connectors       |
| Events          | Kafka (`raw.events` → `entity.extracted`)                          |
| Workflows       | Temporal (`HandleClientReply` approval loop)                       |
| OAuth hub       | Nango server                                                       |
| Observability   | Pino, Loki, optional Sentry                                        |

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Docker](https://docker.com) — full stack via `docker compose`
- [Ollama](https://ollama.com) (optional, for local embeddings/entity extraction) **or** Groq API key

```bash
ollama pull nomic-embed-text
ollama pull llama3:8b
```

## Quick Start

```bash
cd cortex-platform
cp .env.example .env
# Set GROQ_API_KEY, DATABASE_URL, optional CLERK keys

bun install
bun run infra:up        # Kafka, Redis, ES, Neo4j, Temporal, LiteLLM, Nango, Postgres
bun run db:init
bun run build
bun run seed:brain      # vectors + Acme knowledge graph

bun run test:brain      # smoke test (no web server)
bun run dev             # Next.js desks on :3000
```

### Full stack (services + desks)

```bash
bun run services:dev    # integration-service, event-consumer, temporal-worker
bun run test:event      # publish test event to Kafka
bun run temporal:dev    # Temporal worker only
```

## Cortex Brain pipeline

```
Question → reasoning agent → hybrid retrieval (vectors + graph depth-2) → response agent (cited answer)
```

Health: `GET http://localhost:3000/api/brain/health`

## Desks & Admin

| URL                   | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `/executive-desk`     | Exec chat with graph + vector citations               |
| `/clients-desk`       | AI-drafted client replies → Approve & Send (Temporal) |
| `/approvals`          | Pending write-action approvals                        |
| `/admin`              | Dashboard stats                                       |
| `/admin/connections`  | 700+ connector catalogue + Nango status               |
| `/admin/logs`         | Event / activity feed                                 |
| `/admin/improvements` | AI monitoring suggestions                             |

## Demo queries

**Executive Desk:** `Who is working on the Acme launch and what's blocking it?`

Expected: citations from graph nodes (PROJ-101, Jane, API keys) + vector docs.

**Clients Desk:** Select email → **Reply with AI** → **Approve & Send** → approval workflow → Gmail send (or simulated log).

## Environment

See `.env.example`. Key vars:

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=...
LITELLM_URL=http://localhost:4000
DATABASE_URL=postgresql://cortex:cortex@localhost:5434/cortex
KAFKA_BROKERS=localhost:9092
TEMPORAL_ADDRESS=localhost:7233
NANGO_SERVER_URL=http://localhost:3003
REDIS_URL=redis://localhost:6380
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   # optional — protects desk routes when set
```

## Monorepo structure

```text
cortex-platform/
├── apps/web/                 # Next.js desks + API routes
├── packages/
│   ├── agent-core/           # Brain, hybrid RAG, approvals
│   ├── graph-core/           # pgvector + Postgres graph
│   ├── integration-core/     # Connectors (adapted from Activepieces)
│   ├── shared/               # LLM, Kafka, Temporal client
│   ├── auth/                 # Clerk + Permit stub
│   └── ui/                   # Galvanite chat components
├── services/
│   ├── event-consumer/       # Kafka → graph + vectors
│   ├── integration-service/  # Nango REST proxy
│   ├── temporal-worker/      # HandleClientReply workflow
│   ├── monitoring-agent/     # Daily QA eval → improvements
│   └── ingestion-service/    # Slack spoke
├── scripts/
│   ├── adapt-connectors.ts   # Activepieces → integration-core
│   ├── seed-graph.ts         # Brain seed
│   └── publish-test-event.ts
├── infra/litellm/            # LiteLLM routing config
└── docker-compose.yml        # Full local stack
```

## Connectors

```bash
# Requires ../activepieces-main sibling repo
bun run adapt:connectors           # core 5
bun run adapt:connectors --all       # 700+ pieces → registry.generated.ts
```

Core connectors (hand-adapted): Slack, Gmail, GitHub, Linear, Notion.

## API routes

| Route                        | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `POST /api/executive-ask`    | Brain Q&A with citations               |
| `POST /api/client-reply`     | Draft reply + start Temporal workflow  |
| `POST /api/approvals`        | Approve/deny write actions             |
| `GET /api/connectors/status` | Nango + connector health               |
| `GET /api/admin/*`           | Stats, logs, improvements, connections |

## Scripts

```bash
bun dev                 # Web + watch packages
bun run build           # Build all
bun run typecheck       # TS check (adapted connectors excluded)
bun run infra:up        # Docker full stack
bun run seed:brain      # Vectors + graph
bun run test:brain      # Brain smoke test
bun run test:event      # Kafka test publish
bun run adapt:connectors
bun run services:dev    # Background services
```

See `completion.md` for detailed status.
