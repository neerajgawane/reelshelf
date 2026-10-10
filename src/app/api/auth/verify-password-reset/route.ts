import { prisma } from "@/lib/db";
import { AppError, clientIp, json, parseBody, route } from "@/lib/http";
import { signResetToken } from "@/lib/jwt";
import { verifyOtp } from "@/lib/otp";
import { enforceRateLimit } from "@/lib/rateLimit";
import { phoneCodeSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const { phone, code } = await parseBody(req, phoneCodeSchema);
  await enforceRateLimit(`verify:ip:${clientIp(req)}`, 30, 900);
  await enforceRateLimit(`verify:phone:${phone}`, 10, 900);

  const user = await prisma.user.findUnique({ where: { phone } });
  // consume:false -> the challenge stays open until the new password is actually set.
  const result = user?.phoneVerified ? await verifyOtp(user.id, "PASSWORD_RESET", code, { consume: false }) : null;

  if (!user || result?.status !== "verified") {
    throw new AppError(400, "INVALID_CODE", "That code is invalid or has expired.", { status: "invalid" });
  }
  const resetToken = await signResetToken(user.id, result.challengeId);
  return json({ status: "verified", resetToken, expiresInSeconds: 600 });
});
