import { describe, expect, it } from "vitest";
import { api } from "../src/services/api";
// Real HTTP requests: requires the backend on VITE_API_BASE_URL.
describe("Live frontend-to-backend integration", () => {
  it("reports real service connectivity", async () => {
    const result = await api.health();
    expect(result.status).toBe("up");
    for (const service of Object.values(result.services))
      expect(service.status).toBe("up");
  });
  it("loads real project and deployment lists", async () => {
    expect(Array.isArray(await api.projects())).toBe(true);
    expect(Array.isArray(await api.deployments())).toBe(true);
  });
  it("receives numeric database counts", async () => {
    const result = await api.summary();
    expect(Object.keys(result).sort()).toEqual([
      "failedDeployments",
      "successfulDeployments",
      "totalDeployments",
      "totalProjects",
    ]);
    for (const count of Object.values(result)) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
