import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/session";

// `id` is the external (IMDb) movie id. Scoped to the signed-in user, so nobody can delete another user's row.
export const DELETE = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await prisma.savedMovie.deleteMany({ where: { userId: user.id, externalMovieId: id } });
  return json({ status: "removed" });
});
