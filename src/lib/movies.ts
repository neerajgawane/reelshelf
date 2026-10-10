// Server-only IMDb236 (RapidAPI) integration. All provider quirks live in this file.
import { AppError } from "./http";

export type Movie = {
  id: string;
  title: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
};

export type MovieDetails = Movie & {
  description: string | null;
  genres: string[];
  runtimeMinutes: number | null;
  votes: number | null;
};

export type MoviePage = { items: Movie[]; page: number; pageSize: number; total: number; totalPages: number };

export const PAGE_SIZE = 12;
const SEARCH_FETCH_ROWS = 50;

type RawMovie = Record<string, unknown>;

// Best-effort in-memory cache + in-flight de-duplication (per server instance).
const cache = new Map<string, { expires: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = load()
    .then((value) => {
      cache.set(key, { expires: Date.now() + ttlMs, value });
      if (cache.size > 200) cache.delete(cache.keys().next().value as string);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function imdb(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST ?? "imdb236.p.rapidapi.com";
  if (!key) throw new AppError(503, "MOVIES_UNCONFIGURED", "Movie service is not configured.");

  const url = new URL(`https://${host}/api/imdb${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AppError(502, "MOVIES_UNREACHABLE", "Couldn't reach the movie service. Try again.");
  }
  if (res.status === 429) throw new AppError(503, "MOVIES_QUOTA", "The movie service is busy. Try again in a moment.");
  if (!res.ok) throw new AppError(502, "MOVIES_ERROR", "The movie service returned an error.");
  return res.json();
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function normalize(raw: RawMovie): Movie | null {
  const id = str(raw.id);
  const title = str(raw.primaryTitle) ?? str(raw.originalTitle);
  if (!id || !title) return null;
  return {
    id,
    title,
    poster: str(raw.primaryImage),
    year: num(raw.startYear) ?? num(raw.releaseYear),
    rating: num(raw.averageRating),
  };
}

function extractList(payload: unknown): RawMovie[] {
  if (Array.isArray(payload)) return payload as RawMovie[];
  if (payload && typeof payload === "object") {
    const results = (payload as { results?: unknown }).results;
    if (Array.isArray(results)) return results as RawMovie[];
  }
  return [];
}

function paginate(all: Movie[], page: number): MoviePage {
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return { items: all.slice(start, start + PAGE_SIZE), page: safePage, pageSize: PAGE_SIZE, total, totalPages };
}

function dedupe(list: Movie[]): Movie[] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

export async function browseMovies(page: number): Promise<MoviePage> {
  const path = process.env.IMDB_BROWSE_PATH ?? "/most-popular-movies";
  const all = await cached(`browse:${path}`, 10 * 60_000, async () =>
    dedupe(extractList(await imdb(path)).map(normalize).filter((m): m is Movie => m !== null)),
  );
  return paginate(all, page);
}

export async function searchMovies(query: string, page: number): Promise<MoviePage> {
  const q = query.trim().toLowerCase();
  const all = await cached(`search:${q}`, 5 * 60_000, async () =>
    dedupe(
      extractList(await imdb("/search", { type: "movie", primaryTitle: query.trim(), rows: String(SEARCH_FETCH_ROWS) }))
        .map(normalize)
        .filter((m): m is Movie => m !== null),
    ),
  );
  return paginate(all, page);
}

export async function getMovieDetails(id: string): Promise<MovieDetails> {
  if (!/^tt\d{5,12}$/.test(id)) throw new AppError(400, "INVALID_MOVIE_ID", "That movie id isn't valid.");
  return cached(`details:${id}`, 60 * 60_000, async () => {
    const raw = (await imdb(`/${id}`)) as RawMovie;
    const base = normalize(raw);
    if (!base) throw new AppError(404, "MOVIE_NOT_FOUND", "Movie not found.");
    return {
      ...base,
      description: str(raw.description),
      genres: Array.isArray(raw.genres) ? raw.genres.filter((g): g is string => typeof g === "string") : [],
      runtimeMinutes: num(raw.runtimeMinutes),
      votes: num(raw.numVotes),
    };
  });
}
