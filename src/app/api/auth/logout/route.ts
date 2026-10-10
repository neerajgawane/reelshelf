import { json, route } from "@/lib/http";
import { destroySession } from "@/lib/session";

export const POST = route(async () => {
  await destroySession();
  return json({ status: "signed_out" });
});
