"use client";
import Link from "next/link";
import type { Movie } from "@/lib/movies";
import { SaveButton } from "./SaveButton";

export function MovieCard({ movie, saved, onToggle }: { movie: Movie; saved: boolean; onToggle: (movie: Movie) => void }) {
  return (
    <article className="card">
      <div className="poster">
        <Link href={`/movie/${movie.id}`} tabIndex={-1} aria-hidden="true">
          {movie.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={movie.poster} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="poster-fallback">{movie.title}</span>
          )}
        </Link>
        <SaveButton saved={saved} title={movie.title} onToggle={() => onToggle(movie)} />
      </div>
      <h3 className="card-title">
        <Link href={`/movie/${movie.id}`}>{movie.title}</Link>
      </h3>
      <p className="card-meta">
        {movie.year && <span>{movie.year}</span>}
        {movie.rating !== null && <span className="rating">★ {movie.rating.toFixed(1)}</span>}
      </p>
    </article>
  );
}

export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card">
          <div className="poster skeleton" />
          <div className="skeleton line" />
          <div className="skeleton line short" />
        </div>
      ))}
    </div>
  );
}
