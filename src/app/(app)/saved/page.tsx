import type { Metadata } from "next";
import { SavedMovies } from "@/components/SavedMovies";

export const metadata: Metadata = { title: "My shelf" };

export default function SavedPage() {
  return (
    <>
      <h1 className="page-title">My shelf</h1>
      <SavedMovies />
    </>
  );
}
