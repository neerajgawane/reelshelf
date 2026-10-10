import { prisma } from "@/lib/db";
import { AppError, clientIp, json, parseBody, route } from "@/lib/http";
import { burnPasswordCheck, verifyPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rateLimit";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  await enforceRateLimit(`login:ip:${clientIp(req)}`, 30, 900);
  await enforceRateLimit(`login:email:${email}`, 10, 900);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  // Only reachable with the right password, so revealing the phone here leaks nothing new.
  if (!user.phoneVerified) {
    throw new AppError(403, "PHONE_NOT_VERIFIED", "Verify your phone number to finish signing up.", { phone: user.phone });
  }

  await createSession(user.id);
  return json({ user: { id: user.id, name: user.name, email: user.email } });
});
