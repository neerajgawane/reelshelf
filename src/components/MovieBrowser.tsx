"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { useSavedMovies } from "@/hooks/useSavedMovies";
import type { MoviePage } from "@/lib/movies";
import { MovieCard, MovieGridSkeleton } from "./MovieCard";

const DEBOUNCE_MS = 400;

type View = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: MoviePage };

export function MovieBrowser({ initialQuery, initialPage }: { initialQuery: string; initialPage: number }) {
  const [input, setInput] = useState(initialQuery); // what the user is typing
  const [query, setQuery] = useState(initialQuery); // debounced value that drives requests
  const [page, setPage] = useState(initialPage);
  const [view, setView] = useState<View>({ status: "loading" });
  const [retryKey, setRetryKey] = useState(0);
  const committedQuery = useRef(initialQuery);
  const saved = useSavedMovies();

  // Debounce: only commit the query after the user pauses. A new query resets pagination.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = input.trim();
      if (next !== committedQuery.current) {
        committedQuery.current = next;
        setQuery(next);
        setPage(1);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Fetch. Cleanup aborts the in-flight request, so a slow stale response can never overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();
    setView({ status: "loading" });
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);

    api<MoviePage>(`/api/movies/search?${params}`, { signal: controller.signal })
      .then((r) => {
        if (r.ok) setView({ status: "ready", data: r.data });
        else setView({ status: "error", message: errorMessage(r) });
      })
      .catch(() => {
        /* aborted: a newer request replaced this one */
      });
    return () => controller.abort();
  }, [query, page, retryKey]);

  // Keep the URL shareable and the state restorable on refresh / back-forward.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/discover?${qs}` : "/discover");
  }, [query, page]);

  const goTo = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="search">
        <label htmlFor="movie-search" className="sr-only">
          Search movies
        </label>
        <input
          id="movie-search"
          type="search"
          placeholder="Search for a movie"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
        />
      </div>

      {saved.error && (
        <p className="form-error" role="alert">
          {saved.error}
        </p>
      )}

      <div aria-live="polite" aria-busy={view.status === "loading"}>
        {view.status === "loading" && <MovieGridSkeleton />}

        {view.status === "error" && (
          <div className="state">
            <h2>Couldn&rsquo;t load movies</h2>
            <p>{view.message}</p>
            <button className="btn btn-primary" onClick={() => setRetryKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        )}

        {view.status === "ready" && view.data.items.length === 0 && (
          <div className="state">
            <h2>No movies match &ldquo;{query}&rdquo;</h2>
            <p>Check the spelling or try a shorter title.</p>
          </div>
        )}

        {view.status === "ready" && view.data.items.length > 0 && (
          <>
            <p className="results-label">{query ? `Results for “${query}”` : "Popular right now"}</p>
            <div className="grid">
              {view.data.items.map((movie) => (
                <MovieCard key={movie.id} movie={movie} saved={saved.ids.has(movie.id)} onToggle={saved.toggle} />
              ))}
            </div>
            {view.data.totalPages > 1 && (
              <nav className="pager" aria-label="Pagination">
                <button className="btn" disabled={view.data.page <= 1} onClick={() => goTo(view.data.page - 1)}>
                  Previous
                </button>
                <span>
                  Page {view.data.page} of {view.data.totalPages}
                </span>
                <button className="btn" disabled={view.data.page >= view.data.totalPages} onClick={() => goTo(view.data.page + 1)}>
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
