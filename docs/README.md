# Architecture

The frontend uses a typed API client and independent polling hooks for health, SQL counts, projects and deployment history. GitHub repository forms send a management bearer token only on mutation requests. The token stays in React memory and is never part of VITE environment variables or API responses.

ProjectService owns validation and persistence. GitHubRepositoryService resolves a fixed api.github.com public metadata endpoint, rejects redirects/private repositories, and canonicalizes owner/name/stable identity. A future GitHub App provider can replace this adapter. Project IDs, not names, link deployments. Archival retains audit history.

WebhookController requires exact-byte HMAC-SHA256 and constant-time comparison before accepting supported payloads. Nest raw-body support and a 1 MiB non-inflating JSON parser preserve request bytes; malformed input does not reach the ingestion transaction. Global validation, configured CORS, error responses and logging remain in place.

WebhookService transactionally inserts a unique delivery receipt, validates stable repository ID and exact configured branch, creates one queued deployment per project/branch/commit, and inserts an outbox row. Replayed delivery IDs return their prior result, and different payloads reusing an ID get 409. GitHub names, messages and repository content are never executable inputs.

OutboxService scans pending rows every two seconds with FOR UPDATE SKIP LOCKED and dispatches at most 25 per pass. DeploymentQueueService produces BullMQ deployment-queue jobs with deterministic deployment-UUID IDs and only a deploymentId payload. Redis failures retain pending database work. A lost acknowledgement or a database rollback after queue insertion retries the same job ID. The outbox resumes on restart. There is no Worker or queue consumer, so jobs stay waiting and deployments stay queued. Queue storage must not be deliberately purged; dispatched rows are not a backup system.

Schema synchronization is disabled. Phase 2 migration is additive and preserves existing project and deployment rows plus legacy status values. Newly supported phases are queued/preparing/building/testing/deploying/success/failed/cancelled, but only queued is created by this phase. Database connection/query timeouts and Redis command timeouts bound failures.

Health checks still probe SELECT 1 and Redis PING. Named PostgreSQL and Redis volumes persist local state. Shutdown disconnects Redis and closes queue connections. Test fixtures use a separate PostgreSQL schema and Redis prefix and are removed without touching the normal application's data.

Before production or worker implementation: add a complete authentication/authorization model, GitHub App installation permissions, retention/reconciliation policy, isolated workers and safe status transitions. This phase adds neither AI calls nor source cloning, builds, Docker application deployment or rollback. See root README, GITHUB_WEBHOOKS.md, and VERIFICATION.md for operation and evidence.
