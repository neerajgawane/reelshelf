import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodTypeAny, z } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json(data, { status, headers });

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Cheap CSRF defence on top of SameSite=Lax: state-changing requests must come from our own origin.
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  if (!host || new URL(origin).host !== host) {
    throw new AppError(403, "BAD_ORIGIN", "Cross-origin requests are not allowed.");
  }
}

/** Wraps a route handler with origin checks and uniform error responses. */
export function route<C = unknown>(handler: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        const retry = err.extra.retryAfterSeconds;
        return json(
          { error: { code: err.code, message: err.message, ...err.extra } },
          err.status,
          typeof retry === "number" ? { "Retry-After": String(retry) } : undefined,
        );
      }
      if (err instanceof ZodError) {
        return json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Check the highlighted fields.",
              fields: err.flatten().fieldErrors,
            },
          },
          400,
        );
      }
      console.error("Unhandled route error:", err);
      return json({ error: { code: "INTERNAL", message: "Something went wrong. Try again." } }, 500);
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}
