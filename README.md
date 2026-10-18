# AI Auto Deploy Agent

Phase 2 adds public GitHub repository registration, signed push webhooks, durable deployment requests, and BullMQ queue dispatch to the existing Phase 1 dashboard and infrastructure. Pushes matching a connected project's configured branch create a **queued** deployment. There is no worker: cloning, AI analysis, tests/builds, Docker application deployment, and rollback are not executed.

## Prerequisites and structure

Windows PowerShell, Node.js 22.15+ (22 LTS), npm, Git, Docker Desktop with Linux containers. Stack: React 19, TypeScript, Vite, Tailwind CSS 4, NestJS 11, TypeORM, PostgreSQL 16, Redis 7 and BullMQ 5.

```text
backend/src/common/             validation setup, management guard, Redis, errors
backend/src/config/             environment validation
backend/src/database/           entities and versioned migrations
backend/src/modules/projects/   CRUD, DTOs, public GitHub metadata adapter
backend/src/modules/webhooks/   raw signature verification and durable ingestion
backend/src/modules/queue/      BullMQ producer and persistent outbox dispatcher
backend/src/modules/            health, deployments, dashboard
backend/test/                   unit, HTTP, and isolated real-service tests
frontend/src/                   components, pages, hooks, types, API client
frontend/test/                  live API client checks
infrastructure/                 Docker Compose, example environment
docs/                           architecture, webhook setup and verification reports
```

## Installation (PowerShell)

From the project root on a fresh checkout:

```powershell
Copy-Item infrastructure/.env.example infrastructure/.env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

For an existing installation, **keep your .env files** and add only missing variables from the examples. Set matching DB_USERNAME, DB_PASSWORD and DB_DATABASE in infrastructure/.env and backend/.env. Backend also requires GITHUB_WEBHOOK_SECRET and MANAGEMENT_API_TOKEN: use different random secrets of at least 32 characters. Placeholder values are rejected at startup. Never put either secret in VITE_ variables or source control.

To generate secret values locally, run this twice and place each value only in its backend variable:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This workspace already has local secrets generated in the ignored backend/.env. The management token is used only for project changes; it is different from the webhook secret and is never returned by the API. On the Projects page, enter MANAGEMENT_API_TOKEN in the password field. It remains in page memory, not browser storage. Send it only to the local API you configured.

```powershell
Push-Location backend
npm ci
Pop-Location
Push-Location frontend
npm ci
Pop-Location

docker compose --env-file infrastructure/.env -f infrastructure/docker-compose.yml up -d --wait
docker compose --env-file infrastructure/.env -f infrastructure/docker-compose.yml ps

Push-Location backend
npm run migration:run
npm run dev
```

In a second terminal from the project root:

```powershell
Set-Location frontend
npm run dev
```

Open http://localhost:5173. Backend: http://localhost:4000/api/health. A production-style local backend uses `npm run build` then `npm start`; frontend preview uses `npm run build` then `npm run preview -- --host 127.0.0.1 --port 5173`.

## Register and connect GitHub

Open Projects, enter a public HTTPS GitHub URL and branch, then Connect repository. Both `.git` URLs and canonical URLs resolve through the public GitHub REST API. Projects default to `master`; configure `main` or another valid Git branch when required. Repository identity is fetched server-side and cannot be supplied or changed by clients. Private repositories require a future GitHub App adapter.

The user-selected repository `https://github.com/Raj-11-9/raj-portfolio` is registered locally with GitHub ID `1342802688` and branch **main** as requested. Registration alone does not create a webhook in GitHub. Follow [GitHub webhook setup](docs/GITHUB_WEBHOOKS.md) for the temporary tunnel, GitHub settings, a real push, and redelivery checks.

## Environment

| Scope | Variables |
| --- | --- |
| Backend | PORT=4000, NODE_ENV=development, DB_HOST=127.0.0.1, DB_PORT=5432, DB_USERNAME, DB_PASSWORD, DB_DATABASE, REDIS_HOST=127.0.0.1, REDIS_PORT=6379, FRONTEND_URL=http://localhost:5173 |
| Backend secrets | GITHUB_WEBHOOK_SECRET, MANAGEMENT_API_TOKEN; independent random values, minimum 32 characters |
| Frontend public configuration | VITE_API_BASE_URL=http://localhost:4000/api |
| Compose | DB_USERNAME, DB_PASSWORD, DB_DATABASE |

QUEUE_PREFIX optionally isolates queue storage for tests; omit it for the normal `bull` prefix. Queue name is always `deployment-queue`. Redis connection settings come from the backend environment. Its health client and queue producer use separate connections. No secrets or full webhook payloads are stored in queue job data.

## API

| Endpoint | Behavior |
| --- | --- |
| GET /api/health | Actual backend/PostgreSQL/Redis statuses; 503 for dependency failure |
| GET /api/health/database | SELECT 1 probe |
| GET /api/health/redis | PING probe |
| GET /api/projects | Connected/disconnected projects, newest first, maximum 100 |
| POST /api/projects | Register public repository; 201, 409 for duplicate stable identity |
| GET /api/projects/:id | Project detail; UUID validation, 404 if missing/archived |
| PATCH /api/projects/:id | Update name, branch, connection status or canonical URL for the same identity |
| DELETE /api/projects/:id | 204; archive project, preserve deployments/delivery deduplication history |
| GET /api/deployments | Actual records, newest first, maximum 100; commit_sha, trigger_type, queue_job_id and timestamps included |
| GET /api/dashboard/summary | Actual project/deployment/success/failure counts, including historical archived projects |
| POST /api/webhooks/github | Signed JSON ingestion; 202 for accepted, duplicate or ignored deliveries |

POST/PATCH/DELETE project routes require `Authorization: Bearer <MANAGEMENT_API_TOKEN>`. Create body: `repository_url` (required), `name` (optional), `branch` (optional, default master). PATCH permits the same fields plus status `connected` or `disconnected`. Unknown fields are rejected. Archive is deliberate: it disables new triggers while retaining audit history and accepted requests. Previously accepted outbox requests may still dispatch after archival.

Errors use statusCode, error, path, timestamp. Webhook signature failures return 401; malformed headers/payloads 400; delivery-ID payload collisions 409; unsupported encoding 415; JSON body over 1 MiB 413. Health 503 probe details are nested under error. Error logs omit request bodies, tokens and signatures. CORS allows the configured frontend origin; in non-production environments a configured localhost/127.0.0.1 origin also permits its equivalent loopback hostname at the same port. Production keeps only FRONTEND_URL. CORS is not authentication.

## Reliability and status

A database transaction persists a delivery receipt, one deployment per project/branch/commit, and its outbox entry together. Duplicate delivery IDs and duplicate commits cannot create additional deployments. Delivery receipts retain a payload hash and processing timestamps, not the full body. The dispatcher polls every two seconds, locks pending rows with SKIP LOCKED, and adds BullMQ jobs with deterministic `deployment-<uuid>` IDs. A Redis error leaves the row pending; a lost acknowledgement is safe to retry with the same ID. Outbox processing resumes on API restart. At most 25 entries are dispatched per poll; multiple API processes coordinate through database locks.

202 acknowledges durable database acceptance, not completion of dispatch or application deployment. While Redis is unavailable, the deployment remains queued and its outbox row retries. No worker consumes jobs. New statuses are queued/preparing/building/testing/deploying/success/failed/cancelled; Phase 1 pending/running/rolled_back values remain valid for existing data. New push deployments stay queued with started_at/finished_at null.

PostgreSQL acquisition/statement/query timeouts bound database operations. Redis AOF and named volumes preserve queue data across normal restarts. Do not flush Redis or delete queue jobs/volumes: a dispatched outbox row is an acknowledgement, not a backup of deliberately purged queue storage. Replay receipts are retained indefinitely in Phase 2; design an audit-retention policy before production.

## Migrations and tests

Never enable TypeORM synchronization. `npm run migration:run` applies pending migrations; `npm run migration:revert` rolls back the latest migration, removing its integration metadata. Do not revert populated databases without reviewing backups. Phase 2 up migration adds columns, tables, indexes and constraints without deleting existing data.

```powershell
Push-Location backend
npm run build
npm run test
# Requires healthy PostgreSQL + Redis and applied normal migrations:
npm run test:integration
Pop-Location
Push-Location frontend
npm run build
npm run test
# Requires the backend running on localhost:4000:
npm run test:integration
Pop-Location
```

Backend integration tests use real services. Phase 2 fixtures live in a randomly named `phase2_test_*` PostgreSQL schema and a separate Redis queue prefix, then clean up only that test data. They do not seed fake deployments into the normal application. Public GitHub metadata is mocked in these tests; the selected repository was separately resolved through the real public API. Tests cover all requested webhook scenarios, transaction rollback, lost queue acknowledgement and retries. Frontend tests cover registration/errors, queued commit/trigger/time display, polling, and all Phase 1 page interactions. A separate live frontend suite uses actual HTTP requests. Automated fixtures do not prove a delivery originated from GitHub.

See [verification report](docs/VERIFICATION.md) for current test counts and the real-delivery verification status.

## Troubleshooting

- Docker named pipe missing: start Docker Desktop and select Linux containers.
- Database credentials fail: match both environment files. PostgreSQL credentials initialize only on first volume creation; changing .env does not change an existing database password.
- Missing secrets: add strong GITHUB_WEBHOOK_SECRET and MANAGEMENT_API_TOKEN to backend/.env, then restart the API. Keep the two values distinct.
- Repository lookup failure: verify it is public, use its current GitHub URL, check connectivity/rate limits. Redirects are rejected; use the current canonical owner/name. No GitHub access token is required for public metadata.
- Duplicate repository: registration deduplicates by stable GitHub ID including archived projects. Disconnect/reconnect through PATCH rather than registering an existing connected project again. Archived project restoration is not exposed in Phase 2; inspect it administratively rather than deleting audit data.
- No queued deployment: check the configured branch (the selected portfolio uses main), connected status, webhook signature/secret, delivery reason, and whether the commit was already accepted. A GitHub ping is deliberately ignored.
- Queue offline: restore Redis and leave the API running; pending outbox entries retry every two seconds. Health can be degraded while project writes and durable webhook acceptance remain available.
- Database offline: requests cannot be accepted durably. Restore it and redeliver failed GitHub events from Recent deliveries; GitHub does not automatically retry failed deliveries. See [GitHub recovery guidance](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries).
- Port busy: reuse or stop the existing app process. Vite requires 5173; update both the API client and allowed frontend origin if ports change.
- CORS error: FRONTEND_URL must exactly match the frontend origin. Restart Vite after changing frontend environment values.

Stop containers while retaining data:

```powershell
docker compose --env-file infrastructure/.env -f infrastructure/docker-compose.yml down
```

This remains a single-owner development system. Read APIs expose project metadata to anyone who can reach the API, including through an active tunnel. Keep the temporary tunnel short-lived. No actual application deployment or code execution is implemented.
