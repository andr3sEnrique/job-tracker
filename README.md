# Job Application Tracker

A private dashboard for tracking job applications that fills itself from Gmail: it classifies
recruiting emails, extracts the company and role, and keeps each application's history up to
date.

> **Status: phase 8 (production-ready).** Gmail messages are classified with rules (EN/FR/ES)
> and, only when the rules are unsure, with optional AI (Claude Haiku 4.5 or Ollama) under a
> monthly budget. They create or update applications and their timeline; sync is incremental and
> automatic. Email content is never stored. Deploys for free on Vercel + Render + Neon
> ([guide](docs/deploy.md), in Spanish). See the [technical plan](docs/PLAN_TECNICO.md) and the
> [architecture decision records](docs/adr/README.md) (both in Spanish).

## Stack

| Layer    | Technology                                                                                   |
| -------- | -------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo                                                                  |
| Web      | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, TanStack Query/Table, Recharts |
| Shared   | Zod 4: enums and API contracts shared by web and api                                         |
| API      | NestJS + Prisma + PostgreSQL                                                                 |
| AI       | Own port with Anthropic (Claude Haiku 4.5) and Ollama adapters, optional                     |
| Quality  | Strict TypeScript, ESLint, Prettier, Vitest, Testcontainers, Playwright, GitHub Actions      |
| Deploy   | Vercel (web) + Render Docker (api) + Neon (Postgres) + GitHub Actions cron                   |

## Structure

```
apps/
  web/                  Next.js: dashboard (proxies /api/* → api)
  api/                  NestJS: REST API, Prisma schema, migrations and seed
packages/
  shared/               Enums and Zod schemas (API contracts)
  tsconfig/             Shared base tsconfigs
  eslint-config/        Shared ESLint config
docs/                   Technical plan, deployment guide and ADRs
docker-compose.yml      Local PostgreSQL (+ `full` profile with the API in a container)
render.yaml             Render Blueprint for the API
```

## Requirements

- Node.js 22 LTS or later (`nvm use` reads `.nvmrc`)
- pnpm 10 (`corepack enable pnpm`)
- Docker (local PostgreSQL and integration tests)

## Getting started

```bash
pnpm install
pnpm dev          # starts PostgreSQL, applies migrations, runs api + web
pnpm db:seed      # (optional) loads 46 sample applications
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1 (health: `/api/v1/health/ready`)

To sign in you need a Google OAuth client and your email in the allowlist: follow
[docs/setup-google-cloud.md](docs/setup-google-cloud.md) (5 minutes, in Spanish) and copy
[.env.example](.env.example) to `.env`. Every other variable has a default.

To work on the UI only, without the API or signing in: `pnpm dev:mock`.

## Scripts

| Script                  | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm dev`              | PostgreSQL + migrations + api and web in watch mode                  |
| `pnpm dev:mock`         | Web only, with in-memory data                                        |
| `pnpm demo:setup`       | Separate `job_tracker_demo` database with sample applications        |
| `pnpm dev:demo`         | api + web on the demo database, with a synthetic Gmail inbox         |
| `pnpm build`            | Production build of the whole workspace                              |
| `pnpm lint`             | ESLint in every package                                              |
| `pnpm typecheck`        | `tsc --noEmit` (generates the Prisma client and route types first)   |
| `pnpm test`             | Unit and component tests (Vitest)                                    |
| `pnpm test:integration` | API tests against a real PostgreSQL (Testcontainers)                 |
| `pnpm test:e2e`         | Playwright (desktop and mobile) against a production build, mock API |
| `pnpm db:seed`          | Sample data (`-- --force` replaces it, `-- --clear` removes it)      |
| `pnpm db:studio`        | Prisma Studio                                                        |
| `pnpm format`           | Prettier                                                             |

## Deployment (free)

The whole app runs on free tiers, no credit card required:

| Piece       | Service                    | Notes                                                      |
| ----------- | -------------------------- | ---------------------------------------------------------- |
| Web         | **Vercel** Hobby           | Next.js; proxies `/api/*` to the API (same-origin cookies) |
| API         | **Render** Free (Docker)   | Sleeps after ~15 min idle; wakes in 30–60 s                |
| Database    | **Neon** Free (PostgreSQL) | Pooled URL for the app, direct URL for migrations          |
| Auto-sync   | **GitHub Actions** cron    | Calls `POST /api/v1/internal/sync` every 30 min            |
| Login/Gmail | **Google Cloud** OAuth     | Free, no billing account                                   |

Order: Neon → Render (`New → Blueprint` reads [`render.yaml`](render.yaml)) → Vercel (root
directory `apps/web`, [`vercel.json`](apps/web/vercel.json)) → production OAuth client in
Google Cloud → `SYNC_URL` and `CRON_SECRET` repository secrets. Step-by-step instructions and a
final checklist: [docs/deploy.md](docs/deploy.md).

## API

Every route lives under `/api/v1` and validates its input with the Zod schemas in `@jat/shared`.

| Method | Route                           | Description                                                 |
| ------ | ------------------------------- | ----------------------------------------------------------- |
| GET    | `/applications`                 | List with search, filters, sorting and pagination           |
| POST   | `/applications`                 | Manual entry (creates the initial event)                    |
| GET    | `/applications/:id`             | Detail with its event history                               |
| PATCH  | `/applications/:id`             | Partial update (locks the edited fields)                    |
| POST   | `/applications/:id/status`      | Status change (records an event)                            |
| POST   | `/applications/:id/notes`       | Adds a note to the history                                  |
| DELETE | `/applications/:id`             | Deletes the application and its history                     |
| GET    | `/stats/dashboard`              | KPIs, time series and recent activity                       |
| GET    | `/gmail/connect`                | Grants read-only Gmail access (PKCE)                        |
| GET    | `/gmail/callback`               | Stores the encrypted refresh token                          |
| GET    | `/gmail/status`                 | Connection status, counts and last sync                     |
| DELETE | `/gmail`                        | Revokes access and deletes stored emails                    |
| DELETE | `/account`                      | Revokes Gmail and deletes the account and its data          |
| POST   | `/sync/run`                     | Runs one chunk of the sync (`hasMore`)                      |
| POST   | `/internal/sync`                | Syncs every mailbox + maintenance (cron)                    |
| GET    | `/ai/status`                    | Provider, model and this month's spend vs budget            |
| GET    | `/emails`                       | Relevant emails, their classification and application       |
| POST   | `/emails/:id/resolve`           | Review: confirm, ignore, assign or create                   |
| POST   | `/emails/reprocess`             | Rebuilds everything derived from emails (keeps manual work) |
| GET    | `/health/live`, `/health/ready` | Liveness and readiness (public)                             |

**Security** (summary; details in the [technical plan §10](docs/PLAN_TECNICO.md#10-seguridad)):

- **Web:** per-request nonce CSP (`script-src 'nonce-…' 'strict-dynamic'`, no `unsafe-inline`
  for scripts), HSTS, `frame-ancestors 'none'`, `X-Frame-Options`, COOP and
  `Permissions-Policy`. The E2E tests fail if the CSP blocks anything.
- **API:** helmet, Zod on every input, rate limits (login 10/min, sync/cron/reprocess 30/min,
  everything else 300/min), logs without headers, query strings or email text.
- **Dependencies:** Dependabot and `pnpm audit --prod` in CI (fails on high vulnerabilities).
- **Data:** full account deletion from Settings; public privacy policy at `/privacy`.

Every route requires a session except `health`, sign-in and `/internal/sync` (a global guard
that denies by default). `/internal/sync` does not use cookies: it requires the `X-Cron-Secret`
header (compared in constant time) and does not exist unless `CRON_SECRET` is set.
State-changing requests also require the `X-Requested-With` header and a valid `Origin`
(CSRF), and sign-in is rate limited. Details in
[docs/setup-google-cloud.md](docs/setup-google-cloud.md#cómo-se-protege-el-acceso).

## How an email is processed

```
Gmail ─► prefilter (headers) ─► metadata stored
                                  │  on sync, oldest first:
                                  ▼
      body (in memory only) ─► classifier ─► extractor ─► matching ─► event
                                (rules)      company,     thread → URL →   + status
                                             role, URL    company+role     recomputed
```

- **Classifier** (`apps/api/src/classification`): prioritised rules (rejection > offer >
  technical > interview > submitted > confirmation > alert > recruiter).
- **AI as a second opinion** (`apps/api/src/ai`, optional): only when the rules return
  `UNKNOWN`, low confidence, or an application email without a company or role. See
  [AI](#ai-optional).
- **Status derived from history**: an application's status is recomputed by replaying its
  events through a forward-only state machine, so email arrival order does not matter and undo
  (ignoring an email) is consistent.
- **Manual edits win**: fields edited by hand are never overwritten by email data.
- **Evaluation**: `fake-mailbox.data.ts` holds synthetic EN/FR/ES emails with the expected
  category, company and role; `dataset.spec.ts` requires all of them to be right. When a real
  email is misclassified, an anonymised version is added there.

## AI (optional)

```
EmailAnalyzer (hybrid) ─► rules ─► confident? ── yes ──► result
                                       │ no
                                       ▼
                         AiEmailAnalyzer (domain: versioned prompt, budget, ai_runs)
                                       │
                         LlmProvider (generic port: text + Zod schema → validated object)
                             ├─ AnthropicProvider (forced tool use)
                             ├─ OllamaProvider (local, free)
                             └─ FakeLlmProvider (tests)
```

- **Off by default** (`AI_PROVIDER=none`): nothing leaves the server.
- **What is sent**: subject, sender domain and the cleaned body, truncated to 4,000 characters
  and **redacted**: no email addresses, phone numbers or link query strings. The email is
  treated as untrusted data (the prompt ignores any instructions it contains).
- **Nothing is made up**: the output is always validated with Zod; if it does not fit,
  `INVALID_OUTPUT` is recorded and the rules are used. A URL that is not in the email is dropped.
- **Cost**: `ai_runs` records tokens, latency and cost of every call. It acts as a cache
  (reprocessing does not pay twice) and as a circuit breaker: once `AI_MONTHLY_BUDGET_USD` is
  reached, only rules are used until next month. With Haiku 4.5 it costs about $0.002 per
  email, and only the uncertain ones get there.
- **Evaluation**: `pnpm --filter @jat/api eval:ai` measures the AI against the rules on the
  synthetic dataset and the anonymised cases (category, company and role) and estimates the
  cost. Run by hand: it spends real tokens.

## Automatic sync

| Type          | When                                             | How                                   |
| ------------- | ------------------------------------------------ | ------------------------------------- |
| `INITIAL`     | First time                                       | Search over the last 180 days         |
| `RESCAN`      | The prefilter rules changed                      | Same, re-evaluating discarded mail    |
| `INCREMENTAL` | Every other time                                 | History API from the last `historyId` |
| `FALLBACK`    | Gmail no longer has that history (≈ 1 week, 404) | Search since the last sync − 1 day    |

- **Who triggers it** (`sync_runs.trigger`): the button (`USER`), the in-process timer
  (`SCHEDULER`, with `SCHEDULER_ENABLED=true`) or an external cron (`CRON`) calling
  `POST /api/v1/internal/sync`. On free hosting the instance sleeps and an in-process timer does
  not run, so production uses the cron:
  [`.github/workflows/sync-cron.yml`](.github/workflows/sync-cron.yml) (secrets `SYNC_URL` and
  `CRON_SECRET`) or any service like cron-job.org.
- **Chunks and resuming**: each call processes a time-bounded chunk; the checkpoint lives in
  `sync_runs`, and an expiring lock stops the button and the cron from processing the same mail
  at once.
- **Maintenance** after each automatic sync: applications in `APPLIED`/`SCREENING` with no
  activity for 30 days (`GHOSTED_AFTER_DAYS`) become `GHOSTED` through a `SYSTEM` event (any
  later email reopens them), and expired sessions are deleted.

## How the web app is organised

- **`src/lib/api`**: an `ApiClient` interface with two implementations: HTTP (validates every
  response with Zod) and in-memory mock (`NEXT_PUBLIC_API_MODE=mock`).
- **Proxy**: `next.config.ts` rewrites `/api/*` to the API, so the browser only talks to one
  origin (no CORS, and the session cookie is first-party).
- **`src/proxy.ts`**: sets the CSP nonce and redirects to `/login` when there is no session
  cookie. The redirect is UX only; the API is what authorises.
- **`src/lib/mocks`**: deterministic dataset plus the filtering and statistics logic, with
  tests. It is the reference for the API endpoints.
- **State in the URL**: filters, sorting and pagination of `/applications` live in the search
  params, validated with the `@jat/shared` schemas.
- **Responsive**: the sidebar becomes a drawer and the table becomes cards below `md`.

## Roadmap

1. ~~Foundation + frontend~~
2. ~~Backend (NestJS) + database~~
3. ~~Authentication (Google OAuth, backend allowlist)~~
4. ~~Gmail integration~~
5. ~~Email classification (rules)~~
6. ~~Automatic sync~~
7. ~~AI classification and extraction~~
8. ~~Production hardening~~: CSP, account deletion, public pages, E2E, dependency audit,
   deployment blueprint and ADRs. Optional next steps: Sentry, Grafana metrics, encrypted
   `pg_dump` backups, and rotating the encryption key without reconnecting Gmail.
