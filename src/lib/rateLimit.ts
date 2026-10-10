import { prisma } from "./db";
import { AppError } from "./http";

/**
 * Fixed-window limiter backed by Postgres (one atomic upsert), so it works across
 * serverless instances. Throws 429 when the limit for `key` is exceeded.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < (now() AT TIME ZONE 'utc') THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < (now() AT TIME ZONE 'utc') THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (row && row.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000));
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again shortly.", { retryAfterSeconds });
  }
}
