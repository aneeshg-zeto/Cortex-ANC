# Cortex — Product Overview

> Handoff doc for AI / collaborators. Describes the app idea, **Panel**, and **Studio** as built today.

---

## 1. App idea (what Cortex is)

**Cortex is a single “brain” for a company** — one intelligence layer that connects business tools (Google Workspace, GitHub, Slack, Notion, Linear, HR systems, etc.) and lets leadership ask questions, see operational truth, and act from one place.

### Core concept

Instead of searching Slack, Gmail, Linear, and Notion separately, users ask Cortex. It:

1. **Retrieves** facts from ingested documents and a knowledge graph
2. **Reasons** across relationships (people, projects, tickets, deals, blockers)
3. **Answers** in plain language with citations back to source tools

Data is **multi-tenant**: each company gets a workspace (`tenant`) with row-level security. Users only see what their role allows.

### Primary surfaces (“desks”)

| Surface             | Route             | Who                      | Purpose                                                           |
| ------------------- | ----------------- | ------------------------ | ----------------------------------------------------------------- |
| **Executive Desk**  | `/executive-desk` | CEO, Client              | AI Q&A over company data — status, blockers, timelines            |
| **Email Desk**      | `/email-desk`     | CEO, Client              | Client / priority email with AI-assisted replies                  |
| **Connectors**      | `/connectors`     | Leadership               | Connect and monitor integrations                                  |
| **Onboarding**      | `/onboarding`     | New workspaces           | Google Workspace required; GitHub + repo selection when connected |
| **HR module**       | `/hr/*`           | HR role                  | Employees, payroll, payslips, leave, emergency notices, plugins   |
| **Employee portal** | `/employee/*`     | Employee role            | Personal todos, leave, payslips, notices                          |
| **Panel**           | `/panel`          | CEO, Client, Super admin | Leadership command center (see §3)                                |
| **Studio**          | `/studio`         | CEO, Client, Super admin | Hex-style analytics & builder workspace (see §2)                  |

### Roles & company access (demo / Zeto)

After sign-in, everyone uses the same **company code** (`Zeto`) and picks a role:

| Role         | Landing                                                    |
| ------------ | ---------------------------------------------------------- |
| **CEO**      | Onboarding → repo selection → Executive Desk               |
| **Client**   | Onboarding → repo selection → Executive Desk               |
| **HR**       | `/hr` (direct)                                             |
| **Employee** | `/employee/dashboard` (direct; must match HR roster email) |

Legacy per-role codes (`Zetohr`, `ZetoEmployee`) still work. Platform admin: `Superadmin`.

All roles under the same company code map into one shared workspace (slug `zeto`). First CEO anchors the tenant; HR and employees join it automatically.

**Panel** and **Studio** sidebar links are visible to **CEO**, **Client**, and **Super admin**.

### Onboarding gates (CEO / Client)

- **Google Workspace** must be connected before Executive Desk.
- If **GitHub** is connected, user must pick repos (`/onboarding/github-repos`) before desk access.
- Logic lives in `packages/shared/src/onboarding/desk-redirect.ts`.

### Data & memory

- **Postgres**: documents (`cortex_documents`), knowledge graph (`cortex_nodes` / `cortex_edges`), Q&A logs, HR, connectors, ingestion progress, studio layouts/workflows/notebooks.
- **Ingestion**: connectors sync into the brain; global status bar shows per-provider progress.
- **Company-size-aware KPIs**: Cortex infers a maturity tier from headcount + connector/doc/project signals (backend only — **not shown in UI**). More employees → more executive KPIs surface on Panel.

### Currency (India-first)

- All money is stored in **INR**.
- Header toggle **₹ INR / $ USD** converts display across HR, Panel KPIs, approvals (rate default ₹83 = $1, env `NEXT_PUBLIC_INR_PER_USD`). Toggle appears on Panel, Studio, and HR dashboard only.

---

## 2. Studio (`/studio`)

**Studio** is a Hex-inspired workspace for building dashboards, light workflows, notebooks, and exploring the knowledge graph. It is separate from Panel: Panel = leadership overview; Studio = build & explore.

**Route:** `/studio` (legacy `/panel/studio` and `/graph` redirect here)  
**Tabs:** query param `?tab=dashboard|workflows|notebook|graph|lineage`

### Global affordances (available while in Studio via App Shell)

| Feature                   | What it does                                                                     |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Command palette**       | `⌘K` / `Ctrl+K` — jump to desks, Panel, Studio tabs, HR, onboarding              |
| **Ingestion status bar**  | Top bar during connector sync — per-provider progress + execution timeline steps |
| **Collaboration cursors** | Live presence on dashboard & notebook (who’s on the page, cursor positions)      |
| **Currency toggle**       | ₹ / $ in header                                                                  |

### Tab: Dashboard (`?tab=dashboard`)

Drag-and-drop **dashboard builder** (12-column grid, auto-save per user).

**Widget catalog:**

| Widget           | Label            | Data source                                     |
| ---------------- | ---------------- | ----------------------------------------------- |
| `metric`         | Headline number  | Documents indexed, connectors live, graph nodes |
| `bar-chart`      | Activity trend   | Q&A sessions last 7 days                        |
| `pie-chart`      | Source mix       | Document count by connector source              |
| `table`          | Recent questions | Latest Executive Desk Q&A from `qa_logs`        |
| `sparkline-list` | Pulse board      | Compact metrics + sparklines                    |
| `text`           | Annotation       | Freeform note block                             |
| `divider`        | Section break    | Visual separator                                |

**Interactions:** drag top bar to move, corner handle to resize, add from library, delete selected, layout persisted to `user_layouts` via `/api/studio/layout`.

### Tab: Workflows (`?tab=workflows`)

Visual **workflow editor** (node canvas, not Temporal execution yet — definition storage + UI).

- Node types: **trigger** (Connector sync, Schedule), **action** (Send email, Create issue), **condition** (If/else)
- Connect nodes by click-to-link
- Save/load workflows via `/api/studio/workflows`
- Seeded example: “Weekly exec digest” (Monday trigger → fetch → summarize → notify)

### Tab: Notebook (`?tab=notebook`)

Light **notebook editor** (Notion/Hex-lite).

- Block types: **heading**, **text**, **bullet**, **code**, **embed**
- Title + blocks auto-saved to `studio_notebooks` via `/api/studio/notebooks`
- Collaboration cursors on the page

### Tab: Graph (`?tab=graph`)

**Knowledge graph explorer** — force-directed SVG view of `cortex_nodes` / `cortex_edges`.

- Pan/zoom, node type colors (Person, Project, Ticket, Connector, System, Deal, etc.)
- Falls back to **sample seed graph** when tenant graph is empty (badge: “Sample data — connect tools”)
- API: `/api/panel/graph-overview` (shared with Panel)

### Tab: Lineage (`?tab=lineage`)

**Data lineage view** — how connector data flows into tables/metrics/documents.

- Force-layout graph: connector → table → metric/document nodes
- API: `/api/studio/lineage`
- Shows provenance story for analytics (where numbers come from)

### Studio APIs (backend)

| Endpoint                                | Purpose                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| `GET/POST /api/studio/layout`           | User dashboard layout JSON                               |
| `GET/POST/DELETE /api/studio/workflows` | Workflow definitions                                     |
| `GET/POST /api/studio/notebooks`        | Notebook blocks                                          |
| `GET/POST /api/studio/presence`         | Active user cursors per page                             |
| `GET /api/studio/metrics`               | Document/connector/node counts, timeline, source gallery |
| `GET /api/studio/lineage`               | Lineage nodes/edges                                      |

**DB migration:** `scripts/migrations/010_studio.sql` — `user_layouts`, `workflows`, `studio_notebooks`, `active_presence`.

---

## 3. Panel (`/panel`)

**Panel** is the **leadership command center** — workspace health, executive KPIs, approvals, projects, and (for platform admin) deep system stats.

**Who:** CEO, Client, Super admin (`canAccessPanel`)  
**Sub-nav:** Overview (`/panel`), Approvals (`/panel/approvals`, CEO/Client reviewers only)

### Overview (`/panel`)

#### A. System health strip

Live dots for **Kafka**, **Temporal**, **Integration API**, **Connectors** (from `/api/admin/stats`).

#### B. Executive KPI pane (CEO / Client)

Company-size-aware **KPI grid** — tier inferred from HR headcount + signals; user never sees “Tier 1/2/3” labels.

**Tier 1 KPIs (startup, &lt;30 employees if no HR else tier follows headcount):**

| KPI                             | Category | Source / notes                                        |
| ------------------------------- | -------- | ----------------------------------------------------- |
| Cash runway                     | Finance  | Estimate from payroll burn vs demo cash reserve (INR) |
| Monthly revenue & expenses      | Finance  | Monthly payroll exposure from `hr_employees`          |
| Active projects & overdue tasks | Projects | GitHub issues/PRs + project count                     |
| Team mood                       | People   | Demo pulse score when employees exist                 |
| Open support tickets            | Support  | Placeholder — connect Zendesk                         |
| Recent critical emails          | Ops      | Gmail docs indexed last 7 days                        |
| Connected tools health          | Ops      | Connector sync status                                 |

**Tier 2 KPIs (scaling, ≥30 employees):**  
Revenue growth MoM, CAC & LTV, dept headcount & attrition, project delivery velocity, eNPS, sales pipeline, support resolution time.

**Tier 3 KPIs (growth, ≥100 employees):**  
Gross margin, churn & expansion, hiring funnel, OKR progress, infra & AI token usage, compliance audits.

**KPI UI details:**

- Hero cards + category grid (Finance, Growth, People, Projects, Support, Ops, Sales, Compliance)
- Status badges: Live, Estimate, Connect, Pending
- Sparklines, progress rings, trend arrows
- Connector health strip (Google, GitHub, Slack, etc.)
- Highlights callouts (e.g. pending leave, missing Google)
- API: `GET /api/panel/ceo-kpis`

#### C. Workspaces overview

Multi-workspace / project visibility for managers — assignments and project list (`/api/panel/workspaces-overview`, `/api/panel/project-assignments`).

#### D. GitHub scope / client projects (CEO managers)

Compact **client projects panel** — GitHub repos per project, ingest scope (`ClientProjectsPanel`).

#### E. Workspace rename

CEO can edit **workspace display name** inline (`/api/panel/workspace`).

#### F. Live activity ticker

Scrolling feed of recent Q&A / system events on the overview.

#### G. Knowledge graph preview (overview section)

Mini graph overview + stats cards (documents, connectors, nodes) — shares graph API with Studio.

### Approvals (`/panel/approvals`)

**HR employee approvals** — when HR adds employees, CEO or Client must approve before roster is live.

- List pending requests with name, email, department, designation, salary (INR/USD toggle)
- Approve / Deny
- API: `/api/panel/approvals`

### Admin (`/panel/admin`)

**Platform admin only** (`super_admin`) — full `PanelDashboard` in admin view:

- Events ingested + sparkline
- Active connectors progress
- Knowledge graph node/edge counts
- Documents indexed + source breakdown
- Email approvals queue count
- AI improvement suggestions tab
- **All users** table (email, role, tenant)
- Connector gallery, Q&A log review, graph explorer embed, resync controls

### Panel vs Studio (mental model)

|               | **Panel**                    | **Studio**                            |
| ------------- | ---------------------------- | ------------------------------------- |
| **Job**       | “How is the company doing?”  | “Let me build views and explore data” |
| **Audience**  | CEO / Client leadership      | Same + power users                    |
| **KPIs**      | Built-in executive KPI tiers | Custom drag-drop widgets              |
| **Graph**     | Small preview / stats        | Full explorer + lineage               |
| **Workflows** | —                            | Visual workflow builder               |
| **Notebook**  | —                            | Blocks for notes & SQL-style snippets |

### Feature placement map (CEO / Client / HR)

#### Panel (`/panel`) — always-on leadership surface

| Feature                        | Where                                                                     |
| ------------------------------ | ------------------------------------------------------------------------- |
| **Pulse strip**                | Top of every Panel page (burn, PRs, overdue, email, blockers, connectors) |
| **Executive KPIs**             | Tiered hero + category grid                                               |
| **Blocker radar**              | Overview — stuck GitHub/Linear items by team                              |
| **Project delivery scorecard** | Overview — per-repo red/amber/green                                       |
| **Decision log**               | Overview — log decisions + auto-attach recent context                     |
| **Headcount cost burn ring**   | Overview — payroll donut by department (INR)                              |
| **Connector freshness**        | Overview — last sync + stale >24h flags                                   |
| **Approvals**                  | `/panel/approvals`                                                        |

#### Studio (`/studio`) — widget library + canvas

All analytics widgets live in the **sidebar library** (Core blocks + Executive analytics). Only a few are on the default board; drag the rest on when needed.

| Feature                                                            | Sidebar group       | On default board? |
| ------------------------------------------------------------------ | ------------------- | ----------------- |
| Headline number, bar/pie charts, table, pulse board, text, divider | Core blocks         | Some              |
| **Exec email digest**                                              | Executive analytics | **Yes**           |
| **Velocity tracker**                                               | Executive analytics | **Yes**           |
| **Org activity heatmap**                                           | Executive analytics | No — drag in      |
| **AI usage & cost**                                                | Executive analytics | No — drag in      |

Workflows, notebook, graph, lineage remain separate tabs (not dashboard widgets).

#### HR (`/hr`) — people operations

| Feature                        | Route                                   |
| ------------------------------ | --------------------------------------- |
| Attrition risk heatmap         | `/hr/analytics` → Attrition risk        |
| Payroll anomaly flag           | `/hr/analytics` → Payroll anomalies     |
| Headcount timeline             | `/hr/analytics` → Headcount timeline    |
| Department salary distribution | `/hr/analytics` → Salary spread         |
| Onboarding completion tracker  | `/hr/analytics` → Onboarding            |
| Leave balance summary          | `/hr/analytics` → Leave balances        |
| Emergency notice reach         | `/hr/analytics` → Notice reach          |
| Payslip delivery status        | `/hr/analytics` → Payslip delivery      |
| Plugin utilisation             | `/hr/analytics` → Plugin utilisation    |
| **Leave calendar**             | `/hr/calendar` (dedicated monthly view) |

---

## 4. Related modules (context for Claude)

Not Panel/Studio, but part of the same app:

### HR (`/hr`)

Dashboard, Employees (roster + sparklines by dept salary), Payroll runs, Payslips, Leave, Emergency notices, Plugins (Darwinbox/Keka/greytHR catalog), CSV upload + validation.

### Employee portal (`/employee`)

Dashboard, todos, leave submission, payslips, emergency notices.

### Auth & stack

- **Next.js** app (`apps/web`), **Better Auth**, **Postgres**, optional Kafka/Temporal/Neo4j in full local stack
- **Railway slim deploy**: web + Postgres only (`NEXT_PUBLIC_SLIM_DEPLOY`)
- Monorepo: `packages/shared`, `packages/auth`, `packages/agent-core`, `packages/graph-core`

---

## 5. Key file map

| Area            | Paths                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Studio UI       | `apps/web/components/studio/*`, `apps/web/app/studio/*`                                                    |
| Studio APIs     | `apps/web/app/api/studio/*`                                                                                |
| Panel UI        | `apps/web/components/panel/*`, `apps/web/app/panel/*`                                                      |
| Executive KPIs  | `packages/shared/src/panel/ceo-kpi-store.ts`, `kpi-tiers.ts`, `apps/web/components/panel/ceo-kpi-pane.tsx` |
| Onboarding gate | `packages/shared/src/onboarding/desk-redirect.ts`                                                          |
| App shell / nav | `apps/web/components/app-shell.tsx`                                                                        |
| Currency        | `apps/web/lib/currency.ts`, `apps/web/components/currency-toggle.tsx`                                      |
