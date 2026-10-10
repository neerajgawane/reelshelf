import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, clientIp, json, parseBody, route } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rateLimit";
import { signupSchema } from "@/lib/validation";
import { OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_SECONDS, issueOtp } from "@/lib/otp";

export const POST = route(async (req) => {
  await enforceRateLimit(`signup:ip:${clientIp(req)}`, 10, 3600);
  const { name, email, password, phone } = await parseBody(req, signupSchema);

  const taken = await prisma.user.findFirst({
    where: { phoneVerified: true, OR: [{ email }, { phone }] },
    select: { id: true },
  });
  // Trade-off: signup has to tell the person their email/phone is taken, so this endpoint does reveal that.
  // Login, OTP and reset endpoints never do.
  if (taken) throw new AppError(409, "ACCOUNT_EXISTS", "An account with this email or phone number already exists.");

  const passwordHash = await hashPassword(password);
  let user;
  try {
    // Unverified leftovers for the same email/phone are reclaimed so a failed signup never blocks the real owner.
    [, user] = await prisma.$transaction([
      prisma.user.deleteMany({ where: { phoneVerified: false, OR: [{ email }, { phone }] } }),
      prisma.user.create({ data: { name, email, phone, passwordHash } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, "ACCOUNT_EXISTS", "An account with this email or phone number already exists.");
    }
    throw err;
  }

  const sent = await issueOtp(user, "SIGNUP_VERIFY");
  if (sent.status === "delivery_failed") {
    throw new AppError(502, "OTP_DELIVERY_FAILED", "We couldn't send the WhatsApp code. Check the number and try again.");
  }
  if (sent.status === "throttled") {
    throw new AppError(429, "RATE_LIMITED", "Too many codes requested. Try again later.", {
      retryAfterSeconds: sent.retryAfterSeconds,
    });
  }

  return json(
    { status: "pending", phone: user.phone, expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS },
    201,
  );
});
