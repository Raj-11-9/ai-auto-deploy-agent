import { createHash, createHmac, timingSafeEqual } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
export function verifyGitHubSignature(
  raw: Buffer | undefined,
  signature: unknown,
  secret: string,
): string {
  if (
    !raw ||
    typeof signature !== "string" ||
    !/^sha256=[a-f0-9]{64}$/i.test(signature)
  )
    throw new UnauthorizedException("Invalid webhook signature");
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(signature.slice(7), "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new UnauthorizedException("Invalid webhook signature");
  return createHash("sha256").update(raw).digest("hex");
}
