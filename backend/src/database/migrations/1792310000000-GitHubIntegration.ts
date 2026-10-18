import { MigrationInterface, QueryRunner } from "typeorm";
export class GitHubIntegration1792310000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE projects ADD COLUMN github_repository_id bigint UNIQUE, ADD COLUMN repository_owner varchar, ADD COLUMN repository_name varchar`,
    );
    await q.query(`ALTER TABLE deployments DROP CONSTRAINT deployments_status_check,
    ADD CONSTRAINT deployments_status_check CHECK (status IN ('pending','running','rolled_back','queued','preparing','building','testing','deploying','success','failed','cancelled')),
    ADD COLUMN trigger_type varchar NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual','github_push')),
    ADD COLUMN queue_job_id varchar UNIQUE, ADD COLUMN webhook_delivery_id uuid`);
    await q.query(
      `CREATE UNIQUE INDEX idx_deployments_commit ON deployments(project_id, branch, commit_sha) WHERE commit_sha IS NOT NULL AND trigger_type = 'github_push'`,
    );
    await q.query(`CREATE TABLE webhook_deliveries (
    id uuid PRIMARY KEY, payload_hash varchar(64) NOT NULL, event varchar NOT NULL, repository_id bigint,
    commit_sha varchar(40), deployment_id uuid REFERENCES deployments(id) ON DELETE SET NULL,
    state varchar NOT NULL CHECK (state IN ('accepted','ignored','duplicate')), reason varchar NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `CREATE INDEX idx_deliveries_repository ON webhook_deliveries(repository_id, received_at)`,
    );
    await q.query(`CREATE TABLE deployment_outbox (
    deployment_id uuid PRIMARY KEY REFERENCES deployments(id) ON DELETE CASCADE,
    job_id varchar NOT NULL UNIQUE, attempts integer NOT NULL DEFAULT 0, last_attempt_at timestamptz,
    dispatched_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `CREATE INDEX idx_outbox_pending ON deployment_outbox(created_at) WHERE dispatched_at IS NULL`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE deployment_outbox");
    await q.query("DROP TABLE webhook_deliveries");
    await q.query("DROP INDEX idx_deployments_commit");
    await q.query(
      `UPDATE deployments SET status = CASE WHEN status = 'queued' THEN 'pending' ELSE 'running' END WHERE status IN ('queued','preparing','building','testing','deploying')`,
    );
    await q.query(`ALTER TABLE deployments DROP CONSTRAINT deployments_status_check,
    ADD CONSTRAINT deployments_status_check CHECK (status IN ('pending','running','success','failed','cancelled','rolled_back')),
    DROP COLUMN trigger_type, DROP COLUMN queue_job_id, DROP COLUMN webhook_delivery_id`);
    await q.query(
      "ALTER TABLE projects DROP COLUMN github_repository_id, DROP COLUMN repository_owner, DROP COLUMN repository_name",
    );
  }
}
