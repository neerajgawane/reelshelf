"use client";
import Link from "next/link";
import { useSavedMovies } from "@/hooks/useSavedMovies";
import { MovieCard, MovieGridSkeleton } from "./MovieCard";

export function SavedMovies() {
  const saved = useSavedMovies();

  if (!saved.loaded) return <MovieGridSkeleton count={6} />;

  return (
    <>
      {saved.error && (
        <p className="form-error" role="alert">
          {saved.error}
        </p>
      )}
      {saved.items.length === 0 ? (
        <div className="state">
          <h2>Your shelf is empty</h2>
          <p>Tap the bookmark on any movie to keep it here.</p>
          <Link href="/discover" className="btn btn-primary">
            Browse movies
          </Link>
        </div>
      ) : (
        <div className="grid">
          {saved.items.map((item) => (
            <MovieCard
              key={item.externalMovieId}
              movie={{ id: item.externalMovieId, title: item.title, poster: item.poster, year: item.year, rating: item.rating }}
              saved
              onToggle={saved.toggle}
            />
          ))}
        </div>
      )}
    </>
  );
}
