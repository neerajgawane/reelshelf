"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function Header({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const link = (href: string, label: string) => (
    <Link href={href} aria-current={pathname === href ? "page" : undefined}>
      {label}
    </Link>
  );

  return (
    <header className="topbar">
      <Link href="/discover" className="wordmark">
        Reelshelf
      </Link>
      <nav aria-label="Main">
        {link("/discover", "Discover")}
        {link("/saved", "My shelf")}
      </nav>
      <div className="account">
        <span className="account-name">{name}</span>
        <button className="btn btn-quiet" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
