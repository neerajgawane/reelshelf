import type { Metadata } from "next";
import { MovieBrowser } from "@/components/MovieBrowser";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page = "1" } = await searchParams;
  const initialPage = Math.max(1, Math.min(500, Number.parseInt(page, 10) || 1));
  return <MovieBrowser initialQuery={q.slice(0, 100)} initialPage={initialPage} />;
}
