import { prisma } from "@/lib/db";
import { AppError, clientIp, json, parseBody, route } from "@/lib/http";
import { verifyResetToken } from "@/lib/jwt";
import { hashPassword } from "@/lib/passwords";
import { enforceRateLimit } from "@/lib/rateLimit";
import { resetPasswordSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  await enforceRateLimit(`reset:ip:${clientIp(req)}`, 20, 900);
  const { resetToken, newPassword } = await parseBody(req, resetPasswordSchema);

  const claims = await verifyResetToken(resetToken);
  if (!claims) throw new AppError(400, "INVALID_RESET_TOKEN", "This reset link has expired. Start again.");

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  // Atomic: the challenge can be used exactly once, and the password changes only if that claim succeeds.
  const changed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.otpChallenge.updateMany({
      where: { id: claims.challengeId, userId: claims.userId, purpose: "PASSWORD_RESET", verifiedAt: { not: null }, consumedAt: null },
      data: { consumedAt: now },
    });
    if (claimed.count === 0) return false;
    await tx.user.update({ where: { id: claims.userId }, data: { passwordHash } });
    await tx.otpChallenge.updateMany({
      where: { userId: claims.userId, purpose: "PASSWORD_RESET", consumedAt: null },
      data: { consumedAt: now },
    });
    return true;
  });

  if (!changed) throw new AppError(400, "INVALID_RESET_TOKEN", "This reset link has already been used or has expired.");
  return json({ status: "password_reset" });
});
