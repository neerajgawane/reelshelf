import { prisma } from "@/lib/db";
import { AppError, clientIp, json, parseBody, route } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { enforceRateLimit } from "@/lib/rateLimit";
import { createSession } from "@/lib/session";
import { phoneCodeSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const { phone, code } = await parseBody(req, phoneCodeSchema);
  await enforceRateLimit(`verify:ip:${clientIp(req)}`, 30, 900);
  await enforceRateLimit(`verify:phone:${phone}`, 10, 900);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.phoneVerified) {
    throw new AppError(400, "INVALID_CODE", "That code isn't valid.", { status: "invalid" });
  }

  const result = await verifyOtp(user.id, "SIGNUP_VERIFY", code, { consume: true });
  switch (result.status) {
    case "verified": {
      await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
      await createSession(user.id);
      return json({ status: "verified", user: { id: user.id, name: user.name, email: user.email } });
    }
    case "expired":
      throw new AppError(400, "OTP_EXPIRED", "That code has expired. Request a new one.", { status: "expired" });
    case "locked":
      throw new AppError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.", { status: "locked" });
    default:
      throw new AppError(400, "INVALID_CODE", "That code isn't correct.", {
        status: "invalid",
        attemptsLeft: result.attemptsLeft,
      });
  }
});
