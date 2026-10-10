import { json, route } from "@/lib/http";
import { getMovieDetails } from "@/lib/movies";
import { requireUser } from "@/lib/session";

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  return json(await getMovieDetails(id));
});
