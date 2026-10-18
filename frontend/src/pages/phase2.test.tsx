// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Projects from "./Projects";
import { RecentDeployments } from "./Overview";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const project = {
  id: "project-test",
  name: "Connected app",
  repository_url: "https://github.com/example/app",
  branch: "master",
  github_repository_id: "42",
  status: "connected",
};
const deployment = {
  id: "deployment-test",
  project_id: "project-test",
  commit_sha: "abcdef1234567890abcdef1234567890abcdef12",
  branch: "master",
  status: "queued",
  trigger_type: "github_push",
  created_at: "2026-10-18T10:00:00Z",
};
describe("Phase 2 dashboard", () => {
  it("connects a repository with explicit management authorization and refreshes real API data", async () => {
    let connected = false;
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        connected = true;
        return { ok: true, status: 201, json: async () => project };
      }
      return { ok: true, json: async () => (connected ? [project] : []) };
    });
    vi.stubGlobal("fetch", fetch);
    render(<Projects />);
    await screen.findByText("No projects connected yet");
    fireEvent.change(screen.getByLabelText("Repository URL"), {
      target: { value: project.repository_url },
    });
    fireEvent.change(screen.getByLabelText("Management token"), {
      target: { value: "local-management-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect repository" }));
    await screen.findByRole("heading", { name: "Connected app" });
    const post = fetch.mock.calls.find((call) => call[1]?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body)).branch).toBe("master");
    expect((post?.[1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer local-management-token",
    );
    expect(
      fetch.mock.calls
        .filter((call) => !call[1]?.method)
        .every((call) => !call[1]?.headers),
    ).toBe(true);
  });
  it("shows registration errors without claiming success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) =>
        options?.method === "POST"
          ? {
              ok: false,
              status: 409,
              json: async () => ({
                error: { message: "Repository already registered" },
              }),
            }
          : { ok: true, json: async () => [] },
      ),
    );
    render(<Projects />);
    await screen.findByText("No projects connected yet");
    fireEvent.change(screen.getByLabelText("Repository URL"), {
      target: { value: project.repository_url },
    });
    fireEvent.change(screen.getByLabelText("Management token"), {
      target: { value: "local-management-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect repository" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Repository already registered",
      ),
    );
    expect(
      screen.queryByText(
        "Repository connected. Configure its GitHub webhook using the setup guide.",
      ),
    ).toBeNull();
  });
  it("polls and displays queued status, commit, trigger and timestamp from API data", async () => {
    vi.useFakeTimers();
    let rows: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => rows })),
    );
    await act(async () => {
      render(<RecentDeployments />);
    });
    expect(screen.getByText("No deployments yet")).toBeTruthy();
    rows = [deployment];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(screen.getByText("queued")).toBeTruthy();
    expect(screen.getByText("abcdef123456")).toBeTruthy();
    expect(screen.getByText("GitHub push")).toBeTruthy();
    expect(
      screen.getByText(new Date(deployment.created_at).toLocaleString()),
    ).toBeTruthy();
    expect(screen.queryByText("success")).toBeNull();
  });
});
