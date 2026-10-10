import { cookies } from "next/headers";
import { prisma } from "./db";
import { AppError } from "./http";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken, verifySessionToken } from "./jwt";

export async function createSession(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, phoneVerified: true },
  });
  return user?.phoneVerified ? user : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}
