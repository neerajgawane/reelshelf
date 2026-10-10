import { z } from "zod";
import { json, route } from "@/lib/http";
import { browseMovies, searchMovies } from "@/lib/movies";
import { requireUser } from "@/lib/session";

const query = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const GET = route(async (req) => {
  await requireUser();
  const { q, page } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return json(q ? await searchMovies(q, page) : await browseMovies(page));
});
