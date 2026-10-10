import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const GET = route(async () => {
  const { id, name, email } = await requireUser();
  return json({ user: { id, name, email } });
});
