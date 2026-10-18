import type { Health, Summary, Project, Deployment } from "../types/api";
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
export async function request<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal: signal ?? AbortSignal.timeout(8000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return body as T;
}
export async function getHealth(): Promise<Health> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  const health = response.ok ? body : body.error;
  if (!health?.services) throw new Error("Backend unavailable");
  return health as Health;
}
export interface ProjectInput {
  repository_url?: string;
  name?: string;
  branch?: string;
  status?: "connected" | "disconnected";
}
async function mutateProject(
  path: string,
  method: string,
  token: string,
  data?: ProjectInput,
): Promise<Project | undefined> {
  const response = await fetch(`${API_BASE_URL}/projects${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 204) return undefined;
  const body = await response.json();
  if (!response.ok) {
    const message =
      body.error?.message ??
      body.error ??
      `Request failed (${response.status})`;
    throw new Error(
      Array.isArray(message) ? message.join("; ") : String(message),
    );
  }
  return body as Project;
}
export const api = {
  createProject: (data: ProjectInput, token: string) =>
    mutateProject("", "POST", token, data),
  updateProject: (id: string, data: ProjectInput, token: string) =>
    mutateProject(`/${id}`, "PATCH", token, data),
  deleteProject: (id: string, token: string) =>
    mutateProject(`/${id}`, "DELETE", token),
  health: getHealth,
  summary: () => request<Summary>("/dashboard/summary"),
  projects: () => request<Project[]>("/projects"),
  deployments: () => request<Deployment[]>("/deployments"),
};
