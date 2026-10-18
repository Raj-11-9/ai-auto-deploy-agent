import { MigrationInterface, QueryRunner } from "typeorm";
export class InitialSchema1792300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar NOT NULL CHECK (length(trim(name)) > 0),
      repository_url varchar NOT NULL, branch varchar NOT NULL DEFAULT 'master', framework varchar,
      status varchar NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','archived')),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE TABLE deployments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      commit_sha varchar, branch varchar NOT NULL DEFAULT 'master', status varchar NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','running','success','failed','cancelled','rolled_back')),
      started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at)))`);
    await q.query(`CREATE TABLE deployment_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), deployment_id uuid NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
      level varchar NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')), message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      "CREATE INDEX idx_deployments_project ON deployments(project_id)",
    );
    await q.query("CREATE INDEX idx_deployments_status ON deployments(status)");
    await q.query(
      "CREATE INDEX idx_logs_deployment_created ON deployment_logs(deployment_id, created_at)",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE deployment_logs");
    await q.query("DROP TABLE deployments");
    await q.query("DROP TABLE projects");
  }
}
