// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";

const health = {
  status: "up",
  services: {
    backend: { status: "up" },
    database: { status: "up" },
    redis: { status: "up" },
  },
  timestamp: new Date().toISOString(),
};
beforeEach(() => {
  location.hash = "dashboard";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("/health")
          ? health
          : url.endsWith("/summary")
            ? {
                totalProjects: 0,
                totalDeployments: 0,
                successfulDeployments: 0,
                failedDeployments: 0,
              }
            : [],
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function navigate(name: string) {
  fireEvent.click(screen.getByRole("link", { name }));
  // jsdom does not implement browser navigation; deliver the URL event explicitly.
  location.hash = name.toLowerCase();
  fireEvent(window, new HashChangeEvent("hashchange"));
}
describe("Phase 1 dashboard interactions", () => {
  it("loads actual zero counts, healthy services, and deployment empty state", async () => {
    render(<App />);
    await screen.findByText("No deployments yet");
    expect(screen.getAllByText("0")).toHaveLength(4);
    expect(screen.getAllByText("Operational")).toHaveLength(3);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("navigates through all five required pages", async () => {
    render(<App />);
    await navigate("Projects");
    await screen.findByText("No projects connected yet");
    await navigate("Deployments");
    await screen.findByRole("heading", { name: "Deployments" });
    await screen.findByText("No deployments yet");
    await navigate("Logs");
    await screen.findByText("No deployment logs yet");
    await navigate("Settings");
    await screen.findByText("Environment configuration");
    await navigate("Dashboard");
    await screen.findByRole("heading", { name: "Overview" });
  });
  it("shows loading while requests are pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<App />);
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Checking")).toHaveLength(3);
  });
  it("shows failures instead of fake zero counts, and recovers on retry", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Network offline"));
    vi.stubGlobal("fetch", fetch);
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(3));
    expect(screen.queryAllByText("0")).toHaveLength(0);
    expect(screen.getAllByText("Unknown")).toHaveLength(3);
    fetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("/health")
          ? health
          : url.endsWith("/summary")
            ? {
                totalProjects: 0,
                totalDeployments: 0,
                successfulDeployments: 0,
                failedDeployments: 0,
              }
            : [],
    }));
    screen
      .getAllByRole("button", { name: "Try again" })
      .forEach((button) => fireEvent.click(button));
    await waitFor(() => expect(screen.queryAllByRole("alert")).toHaveLength(0));
    expect(screen.getAllByText("0")).toHaveLength(4);
  });
  it("exposes failed dependencies while the backend still responds", async () => {
    const degraded = {
      ...health,
      status: "down",
      services: { ...health.services, database: { status: "down" } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.endsWith("/health"),
        json: async () =>
          url.endsWith("/health")
            ? { error: degraded }
            : url.endsWith("/summary")
              ? {
                  totalProjects: 0,
                  totalDeployments: 0,
                  successfulDeployments: 0,
                  failedDeployments: 0,
                }
              : [],
      })),
    );
    render(<App />);
    await screen.findByText("Unavailable");
    expect(screen.getAllByText("Operational")).toHaveLength(2);
  });
  it("opens and closes mobile navigation when selecting a page", async () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    expect(document.querySelector("aside")?.className).toBe("open");
    await navigate("Projects");
    await screen.findByText("No projects connected yet");
    expect(document.querySelector("aside")?.className).toBe("");
  });
});
