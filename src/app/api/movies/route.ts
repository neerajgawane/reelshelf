import { z } from "zod";
import { json, route } from "@/lib/http";
import { browseMovies } from "@/lib/movies";
import { requireUser } from "@/lib/session";

const query = z.object({ page: z.coerce.number().int().min(1).max(500).default(1) });

export const GET = route(async (req) => {
  await requireUser();
  const { page } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return json(await browseMovies(page));
});
