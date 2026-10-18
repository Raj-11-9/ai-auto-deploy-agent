import { afterEach, describe, expect, it, vi } from "vitest";
import { api, getHealth, request } from "./api";
afterEach(() => vi.unstubAllGlobals());
describe("API integration contract", () => {
  it("fetches real summary endpoint", async () => {
    const data = {
      totalProjects: 0,
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
    };
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetch);
    expect(await api.summary()).toEqual(data);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/dashboard\/summary$/);
  });
  it("preserves degraded health from 503", async () => {
    const health = {
      status: "down",
      services: {
        backend: { status: "up" },
        database: { status: "down" },
        redis: { status: "up" },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          json: async () => ({ error: health }),
        }),
    );
    expect(await getHealth()).toEqual(health);
  });
  it("rejects failed requests instead of fabricating empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    await expect(request("/projects")).rejects.toThrow("500");
  });
  it("reports network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(api.health()).rejects.toThrow("offline");
  });
  it("loads empty projects and deployments", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
    expect(await api.projects()).toEqual([]);
    expect(await api.deployments()).toEqual([]);
  });
});
