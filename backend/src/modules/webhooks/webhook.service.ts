import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { DataSource } from "typeorm";
export interface PushPayload {
  repository: { id: number };
  ref: string;
  after: string;
  deleted: boolean;
}
export function validatePush(value: any): PushPayload {
  if (
    !value ||
    !Number.isSafeInteger(value.repository?.id) ||
    value.repository.id <= 0 ||
    typeof value.ref !== "string" ||
    value.ref.length > 300 ||
    typeof value.deleted !== "boolean" ||
    typeof value.after !== "string" ||
    !/^[a-f0-9]{40}$/i.test(value.after)
  )
    throw new BadRequestException("Invalid GitHub push payload");
  return value;
}
@Injectable()
export class WebhookService {
  constructor(private readonly db: DataSource) {}
  async receive(id: string, hash: string, event: string, body: unknown) {
    const push = event === "push" ? validatePush(body) : undefined;
    return this.db.transaction(async (tx) => {
      const added = await tx.query(
        `INSERT INTO webhook_deliveries (id,payload_hash,event,repository_id,commit_sha,state,reason) VALUES ($1,$2,$3,$4,$5,'ignored','unsupported_event') ON CONFLICT (id) DO NOTHING RETURNING id`,
        [
          id,
          hash,
          event,
          push?.repository.id ?? null,
          push?.after.toLowerCase() ?? null,
        ],
      );
      if (!added.length) {
        const [existing] = await tx.query(
          "SELECT payload_hash, deployment_id, state, reason FROM webhook_deliveries WHERE id=$1",
          [id],
        );
        if (existing.payload_hash !== hash)
          throw new ConflictException(
            "Delivery ID already used for a different payload",
          );
        return {
          status: "duplicate",
          deploymentId: existing.deployment_id,
          reason: existing.reason,
        };
      }
      let reason = "unsupported_event";
      let deploymentId: string | null = null;
      let state = "ignored";
      if (push) {
        const [project] = await tx.query(
          "SELECT id,branch FROM projects WHERE github_repository_id=$1 AND status='connected' FOR UPDATE",
          [String(push.repository.id)],
        );
        if (!project) reason = "unknown_repository";
        else if (push.deleted || /^0+$/.test(push.after))
          reason = "branch_deleted";
        else if (push.ref !== `refs/heads/${project.branch}`)
          reason = "unconfigured_branch";
        else {
          const [deployment] = await tx.query(
            `INSERT INTO deployments (project_id,branch,commit_sha,status,trigger_type,webhook_delivery_id) VALUES ($1,$2,$3,'queued','github_push',$4)
       ON CONFLICT (project_id,branch,commit_sha) WHERE commit_sha IS NOT NULL AND trigger_type='github_push' DO NOTHING RETURNING id`,
            [project.id, project.branch, push.after.toLowerCase(), id],
          );
          if (!deployment) {
            const [existing] = await tx.query(
              "SELECT id FROM deployments WHERE project_id=$1 AND branch=$2 AND commit_sha=$3 AND trigger_type='github_push'",
              [project.id, project.branch, push.after.toLowerCase()],
            );
            deploymentId = existing.id;
            state = "duplicate";
            reason = "duplicate_commit";
          } else {
            deploymentId = deployment.id;
            const jobId = `deployment-${deployment.id}`;
            await tx.query(
              "UPDATE deployments SET queue_job_id=$2 WHERE id=$1",
              [deploymentId, jobId],
            );
            await tx.query(
              "INSERT INTO deployment_outbox (deployment_id,job_id) VALUES ($1,$2)",
              [deploymentId, jobId],
            );
            state = "accepted";
            reason = "dispatch_pending";
          }
        }
      }
      await tx.query(
        "UPDATE webhook_deliveries SET state=$2,reason=$3,deployment_id=$4,processed_at=now() WHERE id=$1",
        [id, state, reason, deploymentId],
      );
      return { status: state, reason, deploymentId };
    });
  }
}
