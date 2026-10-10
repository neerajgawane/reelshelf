import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <Header name={user.name} />
      <main className="page">{children}</main>
    </>
  );
}
