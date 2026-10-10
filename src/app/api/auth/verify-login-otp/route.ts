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
  const result = user?.phoneVerified ? await verifyOtp(user.id, "LOGIN", code, { consume: true }) : null;

  if (!user || result?.status !== "verified") {
    // expired / locked / wrong / unknown phone all look the same, so this can't be used to probe accounts.
    throw new AppError(400, "INVALID_CODE", "That code is invalid or has expired.", { status: "invalid" });
  }
  await createSession(user.id);
  return json({ status: "verified", user: { id: user.id, name: user.name, email: user.email } });
});
