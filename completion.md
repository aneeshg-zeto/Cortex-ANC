# Cortex Platform — Completion Status

**Last updated:** Phase 2.5 ready (~80%)

## Done

| Area                                                                                          | Status |
| --------------------------------------------------------------------------------------------- | ------ |
| Monorepo (Bun + Turborepo, 12 packages)                                                       | ✅     |
| Full infra (`docker compose up -d`) — Kafka, Redis, ES, Neo4j, Temporal, LiteLLM, Loki, Nango | ✅     |
| 706 adapted connectors + 5 core (Slack, Gmail, GitHub, Linear, Notion)                        | ✅     |
| Nango integration service + `/api/connectors/status`                                          | ✅     |
| Kafka event pipeline (`raw.events` → entity extract → graph + vectors → `entity.extracted`)   | ✅     |
| Knowledge graph (Postgres nodes/edges, depth-2 traversal)                                     | ✅     |
| Hybrid retrieval (vector + graph, deduped citations)                                          | ✅     |
| Cortex Brain (`runBrain`: reasoning → hybrid RAG → Groq via LiteLLM)                          | ✅     |
| LiteLLM gateway (chat + embeddings routing)                                                   | ✅     |
| Temporal `HandleClientReply` workflow + worker                                                | ✅     |
| Approvals + write actions (HITL, Gmail send or simulated)                                     | ✅     |
| Monitoring agent stub → `improvement_suggestions`                                             | ✅     |
| Admin UI (`/admin/connections`, `/logs`, `/improvements`)                                     | ✅     |
| Clerk auth (middleware + sign-in/up, optional via env)                                        | ✅     |
| Executive / Clients / Chat desks (Galvanite theme)                                            | ✅     |
| CI + Terraform skeleton                                                                       | ✅     |

## Remaining for production

- Real Nango OAuth apps in Nango dashboard
- Permit.io live API (static role map today)
- LangSmith / full eval suite
- EKS Terraform apply (skeleton only)
- Fix adapted connector TS errors (706 pieces excluded from typecheck)

## Run locally

```bash
cp .env.example .env
bun run infra:up          # all docker services
bun run db:init
bun install && bun run build
bun run seed:brain        # vectors + Acme graph + improvement seed
bun run test:brain        # smoke test brain
bun run test:event        # publish Kafka test event (needs kafka + event-consumer)
bun run services:dev      # integration-service + event-consumer + temporal-worker
bun run dev               # Next.js desks
```

## Ports

| Service       | Port        |
| ------------- | ----------- |
| Web           | 3000        |
| Postgres      | 5434        |
| Kafka         | 9092        |
| Kafka UI      | 9080        |
| LiteLLM       | 4000        |
| Nango         | 3003        |
| Temporal      | 7233        |
| Temporal UI   | 8088        |
| Redis         | 6380        |
| Elasticsearch | 9200        |
| Neo4j         | 7474 / 7687 |
| Loki          | 3100        |
