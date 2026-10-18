import { createHmac } from "crypto";
import { verifyGitHubSignature } from "../src/modules/webhooks/signature";
import { validateBranch } from "../src/modules/projects/project.service";
import { validatePush } from "../src/modules/webhooks/webhook.service";
describe("Webhook security primitives", () => {
  const secret = "test-secret-never-used-outside-tests";
  const raw = Buffer.from('{ "test": true }');
  const signature =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  it("accepts a valid HMAC over exact raw bytes", () =>
    expect(verifyGitHubSignature(raw, signature, secret)).toMatch(
      /^[a-f0-9]{64}$/,
    ));
  it("rejects byte changes including whitespace", () =>
    expect(() =>
      verifyGitHubSignature(Buffer.from('{"test":true}'), signature, secret),
    ).toThrow());
  it.each([
    undefined,
    "",
    "sha1=bad",
    "sha256=short",
    "sha256=" + "z".repeat(64),
    "sha256=" + "0".repeat(64),
  ])("rejects invalid or missing signature %s", (input) =>
    expect(() => verifyGitHubSignature(raw, input, secret)).toThrow(),
  );
  it.each(["master", "main", "release/v1.2", "feature/my-change"])(
    "permits valid configured branch %s",
    (branch) => expect(validateBranch(branch)).toBe(branch),
  );
  it.each([
    "",
    "bad branch",
    "../master",
    "refs//master",
    "foo.lock",
    "feature/../x",
    "x@{y",
    "x\\y",
    "-x",
  ])("rejects invalid branch %s", (branch) =>
    expect(() => validateBranch(branch)).toThrow(),
  );
  it("rejects unsafe repository IDs and malformed commits", () =>
    expect(() =>
      validatePush({
        repository: { id: Number.MAX_SAFE_INTEGER + 1 },
        ref: "refs/heads/master",
        after: "a".repeat(40),
        deleted: false,
      }),
    ).toThrow());
});
