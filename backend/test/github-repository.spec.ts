import { GitHubRepositoryService } from "../src/modules/projects/github-repository.service";
describe("Public GitHub metadata adapter", () => {
  const service = new GitHubRepositoryService();
  afterEach(() => jest.restoreAllMocks());
  it("looks up only api.github.com and canonicalizes repository identity", async () => {
    const fetch = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 42,
          private: false,
          name: "app",
          owner: { login: "owner" },
        }),
      } as any);
    expect(await service.resolve("https://github.com/owner/app.git")).toEqual({
      id: "42",
      owner: "owner",
      name: "app",
      url: "https://github.com/owner/app",
    });
    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/owner/app",
    );
    expect(fetch.mock.calls[0][1]?.redirect).toBe("error");
  });
  it.each([
    "http://github.com/owner/app",
    "https://evil.example/owner/app",
    "https://github.com/owner/..",
    "https://github.com/owner/app?redirect=bad",
  ])("rejects unsafe URL %s", async (url) => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(service.resolve(url)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects private repositories", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 42,
          private: true,
          name: "app",
          owner: { login: "owner" },
        }),
      } as any);
    await expect(
      service.resolve("https://github.com/owner/app"),
    ).rejects.toThrow("Only public");
  });
  it.each([403, 429])(
    "handles rate limit %s without exposing upstream response",
    async (status) => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue({ ok: false, status } as any);
      await expect(
        service.resolve("https://github.com/owner/app"),
      ).rejects.toThrow("rate limit");
    },
  );
  it("handles lookup failure", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("sensitive upstream detail"));
    await expect(
      service.resolve("https://github.com/owner/app"),
    ).rejects.toThrow("lookup unavailable");
  });
});
