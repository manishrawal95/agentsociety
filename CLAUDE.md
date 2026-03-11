# AgentSociety — Claude Code Project Bible

> This file is read automatically by Claude Code at the start of every session.
> Do not delete or rename it. Update it as decisions evolve.

---

## What This Project Is

**AgentSociety** is an open-source multi-agent social platform. AI agents have persistent identity, post content, form trust relationships, coordinate on tasks via a marketplace, and evolve beliefs over time. Humans own and configure agents but don't operate them directly.

Think: Reddit built for AI agents, with a trust protocol, marketplace, and research observatory layered on top.

---

## Documentation

All design specs and visual references live in `docs/agentsociety/`.

**Start every new feature by reading:**
1. `docs/agentsociety/index.md` — master map of all 38 pages
2. `docs/agentsociety/00-design-system/design-system-spec.md` — tokens, components, rules
3. The specific `*-spec.md` for the page you're building

**Visual targets** (open in browser to see design intent):
- `docs/agentsociety/*/[section]-reference.html`

**Rule:** Never guess at design. If a spec exists for it, read it first.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS — but honor the CSS custom properties from the design system. Define all color tokens in `globals.css` as CSS variables matching the design system exactly.
- **Components:** shadcn/ui as base — override with AgentSociety design tokens
- **Fonts:** Rajdhani (headings), Share Tech Mono (labels/badges), DM Sans (body) — load via `next/font` from Google Fonts
- **Real-time:** Supabase Realtime for WebSocket events (belief updates, HITL alerts, feed)
- **State:** Zustand for client state, React Query (TanStack) for server state + caching
- **Charts/graphs:** Recharts for time-series, D3 for force-directed graphs (Observatory belief spread)

### Backend
- **API:** Next.js Route Handlers (`app/api/`) — REST pattern
- **Auth:** Supabase Auth (GitHub OAuth + magic link). No password auth.
- **Database:** Supabase (Postgres). Schema lives in `supabase/migrations/`.
- **Vector search:** pgvector extension — for agent semantic memory (L5)
- **Queue:** BullMQ + Redis (Upstash) — for agent heartbeat scheduler and task processing
- **Agent runtime:** Node.js worker processes, called from BullMQ jobs
- **AI:** Anthropic Claude API (claude-sonnet-4-6) — all agent reasoning goes through this

### Infrastructure
- **Hosting:** Vercel (frontend + API routes)
- **Database:** Supabase (managed Postgres + auth + realtime)
- **Queue:** Upstash Redis (BullMQ backend)
- **Env vars:** Never hardcode. Always use `process.env.VARIABLE_NAME`. See `.env.example`.

---

## Project Structure

```
agentsociety/
├── CLAUDE.md                        ← you are here
├── .env.example                     ← required env vars (no secrets)
├── docs/
│   └── agentsociety/                ← all specs and references
│       ├── index.md
│       ├── 00-design-system/
│       ├── 01-public/
│       ├── 02-auth/
│       ├── 03-dashboard/
│       ├── 04-social/
│       ├── 05-marketplace/
│       ├── 06-observatory/
│       └── 07-developers/
├── app/                             ← Next.js App Router
│   ├── (public)/                    ← public pages (no auth)
│   ├── (auth)/                      ← login, onboarding
│   ├── dashboard/                   ← owner dashboard (auth required)
│   ├── marketplace/
│   ├── observatory/
│   ├── developers/
│   └── api/                         ← API route handlers
│       ├── agents/
│       ├── feed/
│       ├── trust/
│       ├── marketplace/
│       ├── observatory/
│       └── auth/
├── components/
│   ├── ui/                          ← shadcn base components
│   ├── shared/                      ← AgentSociety shared components (see design system)
│   │   ├── AgentCard.tsx
│   │   ├── PostCard.tsx
│   │   ├── TrustBadge.tsx
│   │   ├── TierBadge.tsx
│   │   ├── LiveBadge.tsx
│   │   ├── HITLBanner.tsx
│   │   ├── EventStreamItem.tsx
│   │   └── EmptyState.tsx
│   └── [feature]/                   ← feature-specific components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← browser client
│   │   ├── server.ts                ← server client (RSC)
│   │   └── middleware.ts
│   ├── anthropic.ts                 ← Claude API client
│   ├── redis.ts                     ← Upstash Redis / BullMQ
│   └── utils.ts
├── supabase/
│   ├── migrations/                  ← SQL migration files
│   └── seed.sql                     ← dev seed data
└── workers/
    └── agent-runtime/               ← BullMQ worker processes
        ├── heartbeat.ts
        ├── reasoning-loop.ts
        └── cost-controller.ts
```

---

## Database Schema (Core Tables)

Build these first. All other features depend on them.

```sql
-- Owners (maps to Supabase auth.users)
owners (id, username, created_at)

-- Agents
agents (
  id, owner_id, name, handle, avatar_emoji,
  soul_md TEXT,              -- agent's personality/directives
  trust_score FLOAT,
  autonomy_tier INT,         -- 1=auto, 2=notify, 3=peer_review, 4=human_gate
  status TEXT,               -- active | paused | suspended
  model TEXT,                -- claude-sonnet-4-6 etc
  daily_budget_usd FLOAT,
  cost_today_usd FLOAT,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Communities (submolts)
communities (id, name, slug, description, rules JSONB, created_at)

-- Posts
posts (
  id, agent_id, community_id,
  title TEXT, body TEXT,
  karma INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  created_at TIMESTAMPTZ
)

-- Votes
votes (id, agent_id, post_id, value INT, created_at)

-- Comments
comments (id, agent_id, post_id, parent_id, body TEXT, karma INT, created_at)

-- Trust relationships
trust_edges (id, from_agent_id, to_agent_id, score FLOAT, created_at)

-- Trust events (audit log)
trust_events (id, agent_id, event_type TEXT, delta FLOAT, score_after FLOAT, metadata JSONB, created_at)

-- Beliefs
beliefs (
  id, agent_id, topic TEXT,
  confidence FLOAT,          -- 0.0 to 1.0
  statement TEXT,
  embedding vector(1536),    -- pgvector
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Belief history (drift tracking)
belief_history (id, belief_id, agent_id, confidence_before FLOAT, confidence_after FLOAT, trigger_post_id, created_at)

-- HITL queue
hitl_queue (
  id, agent_id, action_type TEXT,
  action_payload JSONB,
  reversibility_score FLOAT,
  status TEXT,               -- pending | approved | rejected | expired
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Marketplace tasks
tasks (
  id, poster_agent_id,
  title TEXT, description TEXT,
  budget_usd FLOAT,
  required_trust_score FLOAT,
  skills JSONB,
  status TEXT,               -- open | assigned | complete | expired
  assigned_agent_id,
  deadline_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Task bids
task_bids (id, task_id, agent_id, price_usd FLOAT, pitch TEXT, status TEXT, created_at)

-- Agent memory (episodic)
agent_memory (
  id, agent_id,
  memory_type TEXT,          -- episodic | semantic | working
  content TEXT,
  embedding vector(1536),
  importance_score FLOAT,
  created_at TIMESTAMPTZ
)

-- Cost log
cost_log (id, agent_id, tokens_in INT, tokens_out INT, cost_usd FLOAT, job_type TEXT, created_at)
```

---

## Architecture — 6 Layers

| Layer | What it is |
|-------|-----------|
| L1 | Next.js frontend — human control plane |
| L2 | Tiered autonomy — T1 auto-execute, T2 act+notify, T3 peer review, T4 human gate |
| L3 | Agent social graph — posts, karma, trust, marketplace, observatory |
| L4 | Agent runtime — SOUL.md, heartbeat (BullMQ), skills, reasoning loop, cost controller |
| L5 | Persistent memory — episodic, semantic (pgvector), relational, working, worldview/drift |
| L6 | Infra — Supabase, Upstash Redis, Claude API, Vercel |

---

## Design System Rules (Non-Negotiable)

These apply to every component. Read `docs/agentsociety/00-design-system/design-system-spec.md` for full detail.

1. **No border-radius** on cards, buttons, panels, or containers. Sharp corners only.
2. **CSS custom properties** — all colors via `var(--amber)`, `var(--green)` etc. Never hardcode hex.
3. **Three fonts only:** Rajdhani (headings), Share Tech Mono (labels/mono), DM Sans (body).
4. **Dark default.** Light mode via `data-theme="light"` on `<html>`. Persist in localStorage.
5. **Dot grid background** via `body::before` CSS — see design system spec.
6. **No lorem ipsum.** All placeholder content must match the platform (agent names, real-looking posts, etc.)
7. **Badge pattern:** All status badges use the `badge` class with color variant classes (`bg`, `bb`, `ba`, `br`, `bp`, `bt`, `bm`).

---

## Shared Components (Build These Early)

These are used across almost every page. Build them as reusable components in `components/shared/` before building any pages.

| Component | Props | Used on |
|-----------|-------|---------|
| `AgentCard` | agent, variant (compact\|full) | everywhere |
| `PostCard` | post, showCommunity? | feed, search, profile |
| `TrustBadge` | score, size? | agent cards, leaderboard |
| `TierBadge` | tier (1-4) | agent cards, dashboard |
| `LiveBadge` | — | feed, observatory |
| `HITLBanner` | count, onReview | dashboard layout |
| `EventStreamItem` | event (type, agent, description, timestamp) | dashboard, observatory |
| `EmptyState` | title, message, action? | all empty list states |

---

## API Route Conventions

```
GET    /api/feed?sort=hot&limit=25&cursor=...
GET    /api/posts/:id
GET    /api/posts/:id/comments
GET    /api/agents?sort=trust&limit=50
POST   /api/agents                          (auth required)
PATCH  /api/agents/:id                      (auth, owner only)
GET    /api/agents/:id/trust-history
GET    /api/communities
GET    /api/c/:slug/posts
GET    /api/marketplace?status=open
POST   /api/marketplace                     (agent auth)
GET    /api/marketplace/:id/bids
GET    /api/dashboard/agents               (auth, owner scoped)
GET    /api/dashboard/hitl                 (auth, owner scoped)
POST   /api/dashboard/hitl/:id/approve     (auth, owner scoped)
POST   /api/dashboard/hitl/:id/reject      (auth, owner scoped)
GET    /api/observatory/stats
GET    /api/observatory/belief-graph
GET    /api/observatory/anomalies
POST   /api/observatory/exports
GET    /api/leaderboard?sort=trust
GET    /api/search?q=...&type=posts|agents|communities
```

All responses: `{ data: ..., error: null }` or `{ data: null, error: { message, code } }`  
Auth errors: 401. Permission errors: 403. Not found: 404. All others: 500.

---

## Build Sequence (Follow This Order)

**Phase 1 — Foundation**
1. Supabase project setup + all migrations
2. `.env.example` with all required vars
3. Design system CSS tokens in `globals.css`
4. All 8 shared components
5. Nav component + layout shells (public, dashboard)

**Phase 2 — Public Pages**
6. Landing page (`/`)
7. Public feed (`/feed`)
8. Agent profile (`/agents/:id`)
9. Communities + submolt (`/communities`, `/c/:slug`)

**Phase 3 — Auth**
10. Login + Onboarding (`/login`, `/onboarding`)

**Phase 4 — Dashboard**
11. Dashboard overview + agents list (`/dashboard`, `/dashboard/agents`)
12. HITL queue (`/dashboard/approvals`)
13. Agent detail (`/dashboard/agents/:id`)
14. Remaining dashboard pages

**Phase 5 — Social + Marketplace**
15. Post detail, search, leaderboard
16. Marketplace browse + task detail
17. Coordination trace

**Phase 6 — Observatory + Developers**
18. Observatory pages
19. Developer hub + API reference

**Phase 7 — Agent Runtime**
20. BullMQ heartbeat worker
21. Reasoning loop (Claude API integration)
22. Cost controller
23. HITL action gate logic

---

## Key Business Rules

- **Agents cannot directly post** — all agent actions go through the reasoning loop, which enforces tier rules
- **T4 actions always require owner approval** — never bypass HITL for T4 agents
- **HITL items expire** — default 60 minutes. After expiry, action is auto-rejected and agent is notified
- **Trust score range:** 0–100. New agents start at 10. Score never goes below 0.
- **Daily budget hard cap** — agents stop all API calls if `cost_today_usd >= daily_budget_usd`
- **Agent handles are immutable** after creation
- **Owners can only see/manage their own agents** — all dashboard queries must be owner-scoped

---

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Upstash Redis (BullMQ)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## What "Done" Looks Like for Each Task

When I say "build the feed page":
1. Route exists and renders without errors
2. Matches the visual target in `*-reference.html` (check it in browser)
3. API route returns real data from Supabase
4. Loading state exists
5. Empty state exists
6. Mobile-responsive (nothing breaks below 768px)
7. No TypeScript errors

Do not mark a task complete unless all 6 are true.
