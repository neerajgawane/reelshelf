"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client";
import { useSavedMovies } from "@/hooks/useSavedMovies";
import type { MovieDetails as Details } from "@/lib/movies";
import { SaveButton } from "./SaveButton";

export function MovieDetails({ id }: { id: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; movie: Details }>({ status: "loading" });
  const saved = useSavedMovies();

  useEffect(() => {
    const controller = new AbortController();
    api<Details>(`/api/movies/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((r) => setState(r.ok ? { status: "ready", movie: r.data } : { status: "error", message: errorMessage(r) }))
      .catch(() => {});
    return () => controller.abort();
  }, [id]);

  if (state.status === "loading") {
    return (
      <div className="detail" aria-busy="true">
        <div className="poster skeleton" />
        <div>
          <div className="skeleton line" />
          <div className="skeleton line short" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state">
        <h2>Couldn&rsquo;t load this movie</h2>
        <p>{state.message}</p>
        <Link href="/discover" className="btn btn-primary">
          Back to Discover
        </Link>
      </div>
    );
  }

  const { movie } = state;
  const hours = movie.runtimeMinutes ? `${Math.floor(movie.runtimeMinutes / 60)}h ${movie.runtimeMinutes % 60}m` : null;

  return (
    <article className="detail">
      <div className="poster">
        {movie.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.poster} alt={`Poster for ${movie.title}`} />
        ) : (
          <span className="poster-fallback">{movie.title}</span>
        )}
      </div>
      <div>
        <h1>{movie.title}</h1>
        <p className="card-meta">
          {movie.year && <span>{movie.year}</span>}
          {hours && <span>{hours}</span>}
          {movie.rating !== null && <span className="rating">★ {movie.rating.toFixed(1)}</span>}
          {movie.votes !== null && <span>{movie.votes.toLocaleString("en-IN")} votes</span>}
        </p>
        {movie.genres.length > 0 && <p className="genres">{movie.genres.join(", ")}</p>}
        {movie.description && <p className="plot">{movie.description}</p>}
        <div className="detail-actions">
          <button
            className={`btn ${saved.ids.has(movie.id) ? "" : "btn-primary"}`}
            aria-pressed={saved.ids.has(movie.id)}
            disabled={!saved.loaded}
            onClick={() => saved.toggle(movie)}
          >
            {saved.ids.has(movie.id) ? "Remove from shelf" : "Save to shelf"}
          </button>
          <Link href="/discover" className="btn btn-quiet">
            Back to Discover
          </Link>
        </div>
        {saved.error && (
          <p className="form-error" role="alert">
            {saved.error}
          </p>
        )}
      </div>
    </article>
  );
}
