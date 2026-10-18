export function validateEnvironment(env: Record<string, unknown>) {
  for (const key of [
    "DB_HOST",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_DATABASE",
    "REDIS_HOST",
    "FRONTEND_URL",
  ]) {
    if (typeof env[key] !== "string" || !(env[key] as string).trim())
      throw new Error(`Missing environment variable: ${key}`);
  }
  for (const key of ["GITHUB_WEBHOOK_SECRET", "MANAGEMENT_API_TOKEN"]) {
    if (
      typeof env[key] !== "string" ||
      (env[key] as string).length < 32 ||
      (env[key] as string).startsWith("replace_with_")
    )
      throw new Error(`Set a random secret of at least 32 characters: ${key}`);
  }
  for (const [key, fallback] of [
    ["PORT", 4000],
    ["DB_PORT", 5432],
    ["REDIS_PORT", 6379],
  ] as const) {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535)
      throw new Error(`Invalid port: ${key}`);
    env[key] = value;
  }
  const url = new URL(String(env.FRONTEND_URL));
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid FRONTEND_URL");
  return env;
}
