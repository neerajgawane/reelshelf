import { createHmac, randomInt, randomUUID, timingSafeEqual } from "crypto";
import type { OtpPurpose } from "@prisma/client";
import { prisma } from "./db";
import { enforceRateLimit } from "./rateLimit";
import { sendWhatsappOtp } from "./wapix";

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_SENDS_PER_HOUR = 5;

function pepper(): string {
  const value = process.env.OTP_PEPPER;
  if (!value || value.length < 16) throw new Error("OTP_PEPPER must be set (min 16 chars).");
  return value;
}

// HMAC (not a bare hash): a 6-digit code has only 1M possibilities, so the pepper keeps a leaked DB useless.
function hashCode(challengeId: string, code: string): string {
  return createHmac("sha256", pepper()).update(`${challengeId}:${code}`).digest("hex");
}

export type IssueResult =
  | { status: "sent" }
  | { status: "throttled"; retryAfterSeconds: number }
  | { status: "delivery_failed" };

/** Creates a fresh challenge (invalidating older open ones) and sends it over WhatsApp. */
export async function issueOtp(user: { id: string; phone: string }, purpose: OtpPurpose): Promise<IssueResult> {
  const latest = await prisma.otpChallenge.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest) {
    const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return { status: "throttled", retryAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed) };
    }
  }

  try {
    await enforceRateLimit(`otp-send:${purpose}:${user.id}`, OTP_SENDS_PER_HOUR, 3600);
  } catch {
    return { status: "throttled", retryAfterSeconds: 600 };
  }

  const code = String(randomInt(100000, 1000000));
  const id = randomUUID();

  await prisma.$transaction([
    prisma.otpChallenge.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpChallenge.create({
      data: {
        id,
        userId: user.id,
        purpose,
        codeHash: hashCode(id, code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    }),
  ]);

  try {
    await sendWhatsappOtp(user.phone, code);
  } catch (err) {
    console.error("OTP delivery failed:", err instanceof Error ? err.message : err);
    await prisma.otpChallenge.update({ where: { id }, data: { consumedAt: new Date() } });
    return { status: "delivery_failed" };
  }
  return { status: "sent" };
}

export type VerifyResult =
  | { status: "verified"; challengeId: string }
  | { status: "invalid"; attemptsLeft?: number }
  | { status: "expired" }
  | { status: "locked" };

/**
 * Checks a submitted code against the newest open challenge.
 * The attempt counter is incremented *before* comparing, so parallel guesses can't beat the limit.
 * `consume: false` leaves the challenge open (used by password reset, which consumes it on the final step).
 */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
  options: { consume: boolean },
): Promise<VerifyResult> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { userId, purpose, consumedAt: null, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { status: "invalid" };
  if (challenge.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { status: "locked" };

  const updated = await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 } },
  });
  if (updated.attempts > OTP_MAX_ATTEMPTS) return { status: "locked" };

  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashCode(challenge.id, code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) return { status: "invalid", attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts) };

  const now = new Date();
  const claimed = await prisma.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, verifiedAt: null },
    data: { verifiedAt: now, ...(options.consume ? { consumedAt: now } : {}) },
  });
  if (claimed.count === 0) return { status: "invalid" }; // lost a race with another request
  return { status: "verified", challengeId: challenge.id };
}
