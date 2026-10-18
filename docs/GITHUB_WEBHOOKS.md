# Live GitHub webhook setup (PowerShell)

The selected public repository is **Raj-11-9/raj-portfolio**, GitHub ID **1342802688**. Its configured deployment branch is **main**, as requested. New registrations still default to master. Existing local registration does not create a GitHub webhook.

## 1. Start local services

From the workspace root:

```powershell
docker compose --env-file infrastructure/.env -f infrastructure/docker-compose.yml up -d --wait
Push-Location backend
npm run migration:run
npm run dev
```

Keep that terminal running. In another terminal:

```powershell
Set-Location frontend
npm run dev
```

Confirm http://localhost:4000/api/health reports all services up. In the dashboard Projects page, confirm the repository is connected with branch main. To connect another repository, enter its public URL, desired branch and MANAGEMENT_API_TOKEN from the ignored backend/.env.

## 2. Expose the API temporarily

Install cloudflared using the official [Cloudflare downloads instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/). If you already use Windows Package Manager, the Cloudflare package can be installed with:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

Open a new PowerShell window if PATH changed. Start a temporary tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:4000
```

Copy the HTTPS trycloudflare.com hostname from its output. Keep cloudflared running. Its hostname changes on restart, so update the GitHub webhook when it changes. Do not enable interactive email authentication on this tunnel: GitHub is a non-interactive sender. Stop the tunnel with Ctrl+C after testing. These behaviors are documented in [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Alternative for an already configured ngrok account: `ngrok http 4000`, then use its HTTPS forwarding URL. Account/authtoken setup belongs to your ngrok installation and must not be added to this repository.

The tunnel exposes the API, including read-only metadata endpoints. Project mutations require the management token. Use different management and webhook secrets, never put the management token in GitHub's webhook Secret field, and do not expose a worker or Docker socket.

## 3. Configure the repository webhook

With repository admin access, open [Raj Portfolio webhook settings](https://github.com/Raj-11-9/raj-portfolio/settings/hooks), choose Add webhook, then set:

| Setting | Value |
| --- | --- |
| Payload URL | https://YOUR-TUNNEL-DOMAIN/api/webhooks/github |
| Content type | application/json |
| Secret | Exact GITHUB_WEBHOOK_SECRET from backend/.env |
| SSL verification | Enabled |
| Events | Just the push event |
| Active | Enabled |

Save the webhook. GitHub's initial ping should receive HTTP 202 with ignored/unsupported_event; it does not create a deployment. See [GitHub webhook creation](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks) and [signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

## 4. Verify a real push

In your existing portfolio checkout, push a real intended change to main (do not run these from the deployment-agent repository):

```powershell
git branch --show-current
git push origin main
```

For projects configured for master, push to master instead. In GitHub Settings → Webhooks → this webhook → Recent deliveries, open the push delivery. Confirm HTTP 202, accepted status, and a deploymentId. After roughly two seconds, the durable outbox should dispatch the BullMQ job. Within 15 seconds, the dashboard Deployments page should show the matching commit SHA, GitHub push trigger, timestamp and **queued** status. It will not build or become success in Phase 2.

Redeliver the same push and verify no extra deployment appears. A different delivery for the same project/branch/commit is also deduplicated. Pushes to other branches, unknown repositories, disconnected/archived projects and branch deletions are ignored. Switching the configured branch does not execute commands or alter the repository.

## 5. Diagnose and recover

- 401: missing/mismatched signature; compare the GitHub secret with backend/.env and restart backend after environment changes.
- 400: malformed event headers, UUID delivery ID, commit SHA or JSON payload.
- 413: body exceeds the configured 1 MiB limit. Do not disable limits blindly; review the payload and consciously choose a larger bounded limit if required.
- 202 ignored: inspect reason (unsupported_event, unknown_repository, unconfigured_branch, branch_deleted).
- 202 duplicate: delivery or commit was already processed; no additional job is expected.
- Redis outage after 202: request is in PostgreSQL outbox and will dispatch when Redis returns.
- Backend/database outage before acceptance: restore services and use Recent deliveries → Redeliver. [GitHub does not automatically redeliver failed webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries).
- Tunnel stopped/hostname changed: restart it, update Payload URL, and redeliver the failed request.

The signature covers the original JSON bytes, not a parsed/reserialized body. Delivery IDs plus a unique project/branch/commit constraint protect against replay even if delivery headers are changed. The stored digest and delivery state support retries without storing secrets or full request bodies. Deterministic queue IDs retain deduplication until jobs are removed; see [BullMQ job IDs](https://docs.bullmq.io/guide/jobs/job-ids).

## Verification boundary

No real GitHub push delivery has been observed during the implementation run. Local signed fixture tests passed against real PostgreSQL and Redis, and the user's actual public repository was successfully registered through the running API. A temporary tunnel, repository webhook creation and an actual push still require completion with access to the GitHub account. Do not report an end-to-end real delivery until Recent deliveries and the matching persisted deployment have been checked.
