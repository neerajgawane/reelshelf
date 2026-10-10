import { prisma } from "@/lib/db";
import { AppError, clientIp, json, parseBody, route } from "@/lib/http";
import { OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_SECONDS, issueOtp } from "@/lib/otp";
import { enforceRateLimit } from "@/lib/rateLimit";
import { phoneOnlySchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const { phone } = await parseBody(req, phoneOnlySchema);
  await enforceRateLimit(`otp-req:ip:${clientIp(req)}`, 20, 3600);
  await enforceRateLimit(`otp-req:phone:${phone}`, 6, 3600);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (user && !user.phoneVerified) {
    const sent = await issueOtp(user, "SIGNUP_VERIFY");
    if (sent.status === "throttled") {
      throw new AppError(429, "OTP_RESEND_TOO_SOON", "Wait a moment before requesting another code.", {
        retryAfterSeconds: sent.retryAfterSeconds,
      });
    }
  }
  // Same response whether or not a pending signup exists.
  return json({ status: "pending", expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS });
});
