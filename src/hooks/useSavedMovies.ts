"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import type { Movie } from "@/lib/movies";

export type SavedItem = {
  externalMovieId: string;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  createdAt: string;
};

export function useSavedMovies() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    let alive = true;
    api("/api/saved-movies").then((r) => {
      if (!alive) return;
      if (r.ok) setItems(r.data.items);
      else setError(errorMessage(r));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ids = useMemo(() => new Set(items.map((i) => i.externalMovieId)), [items]);

  // Optimistic: update the UI first, roll back if the server says no.
  const toggle = useCallback(async (movie: Movie) => {
    const snapshot = itemsRef.current;
    const isSaved = snapshot.some((i) => i.externalMovieId === movie.id);
    setError(null);

    if (isSaved) {
      setItems((cur) => cur.filter((i) => i.externalMovieId !== movie.id));
      const r = await api(`/api/saved-movies/${encodeURIComponent(movie.id)}`, { method: "DELETE" });
      if (!r.ok) {
        setItems(snapshot);
        setError(errorMessage(r));
      }
      return;
    }

    const payload = { externalMovieId: movie.id, title: movie.title, poster: movie.poster, year: movie.year, rating: movie.rating };
    setItems((cur) => [{ ...payload, createdAt: new Date().toISOString() }, ...cur]);
    const r = await api("/api/saved-movies", { method: "POST", body: payload });
    if (!r.ok) {
      setItems(snapshot);
      setError(errorMessage(r));
    }
  }, []);

  return { items, ids, loaded, error, toggle };
}
