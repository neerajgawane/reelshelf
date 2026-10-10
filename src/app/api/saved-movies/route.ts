import { prisma } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { savedMovieSchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  const items = await prisma.savedMovie.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { externalMovieId: true, title: true, poster: true, year: true, rating: true, createdAt: true },
  });
  return json({ items });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await parseBody(req, savedMovieSchema);
  // Idempotent: the (userId, externalMovieId) unique constraint makes double-saves impossible.
  const saved = await prisma.savedMovie.upsert({
    where: { userId_externalMovieId: { userId: user.id, externalMovieId: data.externalMovieId } },
    create: { userId: user.id, ...data },
    update: {},
    select: { externalMovieId: true, title: true, poster: true, year: true, rating: true, createdAt: true },
  });
  return json({ item: saved }, 201);
});
