// Edge-safe (no Prisma): used by middleware and by server code.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "reelshelf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function key(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be set (min 32 chars).");
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.typ === "session" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Short-lived proof that an OTP was verified for a password reset. */
export async function signResetToken(userId: string, challengeId: string): Promise<string> {
  return new SignJWT({ typ: "pwd-reset", cid: challengeId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key());
}

export async function verifyResetToken(token: string): Promise<{ userId: string; challengeId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "pwd-reset" || !payload.sub || typeof payload.cid !== "string") return null;
    return { userId: payload.sub, challengeId: payload.cid };
  } catch {
    return null;
  }
}
