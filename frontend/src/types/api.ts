export interface Summary {
  totalProjects: number;
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
}
export type Status = "up" | "down" | "unknown";
export interface Health {
  status: string;
  services: {
    backend: { status: Status };
    database: { status: Status };
    redis: { status: Status };
  };
  timestamp: string;
}
export interface Project {
  id: string;
  name: string;
  repository_url: string;
  github_repository_id: string | null;
  repository_owner: string | null;
  repository_name: string | null;
  branch: string;
  framework: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface Deployment {
  id: string;
  project_id: string;
  commit_sha: string | null;
  trigger_type: "manual" | "github_push";
  queue_job_id: string | null;
  webhook_delivery_id: string | null;
  branch: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}
