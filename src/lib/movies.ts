// Server-only IMDb236 (RapidAPI) integration with graceful fallback. All provider quirks live in this file.
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

// Curated IMDb top movies fallback for immediate offline/dev testing and quota protection
const CURATED_MOVIES: MovieDetails[] = [
  {
    id: "tt0111161",
    title: "The Shawshank Redemption",
    poster: "https://m.media-amazon.com/images/M/MV5BMDAyY2FhYjctNDc5OS00MDNlLThiMGUtY2UxYWVkNGY2RR5lXkEyXkFqcGc@._V1_SX300.jpg",
    year: 1994,
    rating: 9.3,
    description: "A banker convicted of uxoricide forms a friendship over a quarter of a century with a hardened convict, while maintaining his innocence and trying to remain hopeful.",
    genres: ["Drama"],
    runtimeMinutes: 142,
    votes: 2900000,
  },
  {
    id: "tt0468569",
    title: "The Dark Knight",
    poster: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_SX300.jpg",
    year: 2008,
    rating: 9.0,
    description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    genres: ["Action", "Crime", "Drama"],
    runtimeMinutes: 152,
    votes: 2800000,
  },
  {
    id: "tt1375666",
    title: "Inception",
    poster: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg",
    year: 2010,
    rating: 8.8,
    description: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    genres: ["Action", "Adventure", "Sci-Fi"],
    runtimeMinutes: 148,
    votes: 2500000,
  },
  {
    id: "tt0816692",
    title: "Interstellar",
    poster: "https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_SX300.jpg",
    year: 2014,
    rating: 8.7,
    description: "When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.",
    genres: ["Adventure", "Drama", "Sci-Fi"],
    runtimeMinutes: 169,
    votes: 2000000,
  },
  {
    id: "tt0110912",
    title: "Pulp Fiction",
    poster: "https://m.media-amazon.com/images/M/MV5BYTViYTE3NWQtNDBlZS00MTA3LTg3ZDEtZWY4NWM4MDlkZTU0XkEyXkFqcGc@._V1_SX300.jpg",
    year: 1994,
    rating: 8.9,
    description: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    genres: ["Crime", "Drama"],
    runtimeMinutes: 154,
    votes: 2200000,
  },
  {
    id: "tt0068646",
    title: "The Godfather",
    poster: "https://m.media-amazon.com/images/M/MV5BNGEwYjgwOGQtYjg5ZS00Njc1LTk2ZGEtM2QzZTE0Yzc3Nzk5XkEyXkFqcGc@._V1_SX300.jpg",
    year: 1972,
    rating: 9.2,
    description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant youngest son.",
    genres: ["Crime", "Drama"],
    runtimeMinutes: 175,
    votes: 2000000,
  },
  {
    id: "tt0137523",
    title: "Fight Club",
    poster: "https://m.media-amazon.com/images/M/MV5BOTgyOGQ1NDItNGU3Ny00MjU3LTg2YTQtNmIzNDNXjcXkEyXkFqcGc@._V1_SX300.jpg",
    year: 1999,
    rating: 8.8,
    description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.",
    genres: ["Drama"],
    runtimeMinutes: 139,
    votes: 2300000,
  },
  {
    id: "tt0109830",
    title: "Forrest Gump",
    poster: "https://m.media-amazon.com/images/M/MV5BNDYwNzVjMTItZmU5YS00YjQ5LTljYjgtMjY2NDVmYWODg1XkEyXkFqcGc@._V1_SX300.jpg",
    year: 1994,
    rating: 8.8,
    description: "The history of the United States from the 1950s to the '70s unfolds through the perspective of an Alabama man with an IQ of 75.",
    genres: ["Drama", "Romance"],
    runtimeMinutes: 142,
    votes: 2200000,
  },
  {
    id: "tt0133093",
    title: "The Matrix",
    poster: "https://m.media-amazon.com/images/M/MV5BN2NmN2VhMTQtMDNiOS00NDlhLTliMjgtODE2ZTY0ODQyNDRhXkEyXkFqcGc@._V1_SX300.jpg",
    year: 1999,
    rating: 8.7,
    description: "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is the elaborate deception of an evil cyber-intelligence.",
    genres: ["Action", "Sci-Fi"],
    runtimeMinutes: 136,
    votes: 2000000,
  },
  {
    id: "tt15398776",
    title: "Oppenheimer",
    poster: "https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmQtZTGCYmZmODQ2MTFjXkEyXkFqcGc@._V1_SX300.jpg",
    year: 2023,
    rating: 8.9,
    description: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    genres: ["Biography", "Drama", "History"],
    runtimeMinutes: 180,
    votes: 750000,
  },
  {
    id: "tt15239678",
    title: "Dune: Part Two",
    poster: "https://m.media-amazon.com/images/M/MV5BNTc0YmQxMjEtODI5MC00NjFiLTlkMWUtOGQ5NjFmGExNTE3XkEyXkFqcGc@._V1_SX300.jpg",
    year: 2024,
    rating: 8.6,
    description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    genres: ["Action", "Adventure", "Drama", "Sci-Fi"],
    runtimeMinutes: 166,
    votes: 500000,
  },
  {
    id: "tt0172495",
    title: "Gladiator",
    poster: "https://m.media-amazon.com/images/M/MV5BYWQ4YmNjYjEtOWE1Zi00Y2U4LWI4NTAtNjEyNzY1MWFjMmNhXkEyXkFqcGc@._V1_SX300.jpg",
    year: 2000,
    rating: 8.5,
    description: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery.",
    genres: ["Action", "Adventure", "Drama"],
    runtimeMinutes: 155,
    votes: 1600000,
  },
  {
    id: "tt6751668",
    title: "Parasite",
    poster: "https://m.media-amazon.com/images/M/MV5BYWZjMjk3ZTItODQ2ZC00NTY5LWE0ZDYtZTI3YjhkN2I5ODDhXkEyXkFqcGc@._V1_SX300.jpg",
    year: 2019,
    rating: 8.5,
    description: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
    genres: ["Drama", "Thriller"],
    runtimeMinutes: 132,
    votes: 950000,
  },
  {
    id: "tt0245429",
    title: "Spirited Away",
    poster: "https://m.media-amazon.com/images/M/MV5BNTEyNmEwOWUtYzkyOC00ZTQ4LTllZmUtMjk0Y2YwOGUzYDUzXkEyXkFqcGc@._V1_SX300.jpg",
    year: 2001,
    rating: 8.6,
    description: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    genres: ["Animation", "Adventure", "Family"],
    runtimeMinutes: 125,
    votes: 850000,
  },
  {
    id: "tt4154796",
    title: "Avengers: Endgame",
    poster: "https://m.media-amazon.com/images/M/MV5BMTc5MDE2ODcwNV5BMl5BanBnXkFtZTgwMzI2NzQ2NzM@._V1_SX300.jpg",
    year: 2019,
    rating: 8.4,
    description: "After the devastating events of Avengers: Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more.",
    genres: ["Action", "Adventure", "Drama"],
    runtimeMinutes: 181,
    votes: 1300000,
  },
  {
    id: "tt9362722",
    title: "Spider-Man: Across the Spider-Verse",
    poster: "https://m.media-amazon.com/images/M/MV5BNThiZjA3MjItZGY5Ni00ZmJhLWEwN2EtOTBlYTA4Y2E0M2ZmXkEyXkFqcGc@._V1_SX300.jpg",
    year: 2023,
    rating: 8.6,
    description: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.",
    genres: ["Animation", "Action", "Adventure"],
    runtimeMinutes: 140,
    votes: 400000,
  },
  {
    id: "tt2582802",
    title: "Whiplash",
    poster: "https://m.media-amazon.com/images/M/MV5BMjA5Njk3MjM4OV5BMl5BanBnXkFtZTgwOTc5NjUwMDE@._V1_SX300.jpg",
    year: 2014,
    rating: 8.5,
    description: "A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing to realize a student's potential.",
    genres: ["Drama", "Music"],
    runtimeMinutes: 106,
    votes: 980000,
  },
  {
    id: "tt0482571",
    title: "The Prestige",
    poster: "https://m.media-amazon.com/images/M/MV5BMjA4NDI0MTIxNF5BMl5BanBnXkFtZTYwNTM0MzY2._V1_SX300.jpg",
    year: 2006,
    rating: 8.5,
    description: "After a tragic accident, two stage magicians in 1890s London engage in a battle to create the ultimate illusion while sacrificing everything they have to outwit each other.",
    genres: ["Drama", "Mystery", "Sci-Fi"],
    runtimeMinutes: 130,
    votes: 1400000,
  },
  {
    id: "tt0407887",
    title: "The Departed",
    poster: "https://m.media-amazon.com/images/M/MV5BMTI1MTY2OTIxNV5BMl5BanBnXkFtZTYwNjQ4NjY3._V1_SX300.jpg",
    year: 2006,
    rating: 8.5,
    description: "An undercover cop and a mole in the police attempt to identify each other while infiltrating an Irish gang in South Boston.",
    genres: ["Crime", "Drama", "Thriller"],
    runtimeMinutes: 151,
    votes: 1450000,
  },
  {
    id: "tt0114388",
    title: "Se7en",
    poster: "https://m.media-amazon.com/images/M/MV5BNTU2ODkyY2MtMjU1NC00NjE1LWEzYjgtMWQ3MzRhMGE0NDEtXkEyXkFqcGc@._V1_SX300.jpg",
    year: 1995,
    rating: 8.6,
    description: "Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.",
    genres: ["Crime", "Drama", "Mystery"],
    runtimeMinutes: 127,
    votes: 1800000,
  },
  {
    id: "tt2380307",
    title: "Coco",
    poster: "https://m.media-amazon.com/images/M/MV5BYjQ5NjM0Y2YtNjZkNC00ZDhkLWJjMWItN2QyNzFkZTk1KQ@@._V1_SX300.jpg",
    year: 2017,
    rating: 8.4,
    description: "Aspiring musician Miguel, confronted with his family's ancestral ban on music, enters the Land of the Dead to find his great-great-grandfather, a legendary singer.",
    genres: ["Animation", "Adventure", "Comedy"],
    runtimeMinutes: 105,
    votes: 600000,
  },
  {
    id: "tt0910970",
    title: "WALL-E",
    poster: "https://m.media-amazon.com/images/M/MV5BMjExMTg5OTU0NF5BMl5BanBnXkFtZTcwMjMxMzMzMw@@._V1_SX300.jpg",
    year: 2008,
    rating: 8.4,
    description: "In the distant future, a small waste-collecting robot inadvertently embarks on a space journey that will ultimately decide the fate of mankind.",
    genres: ["Animation", "Adventure", "Family"],
    runtimeMinutes: 98,
    votes: 1200000,
  },
  {
    id: "tt0078748",
    title: "Alien",
    poster: "https://m.media-amazon.com/images/M/MV5BNmU1OTIxNDAtZGQKOC00M2VmLWI5MzEtZjExMzc4NmE0MDM3XkEyXkFqcGc@._V1_SX300.jpg",
    year: 1979,
    rating: 8.5,
    description: "The crew of a commercial spacecraft encounters a deadly lifeform after investigating an unknown transmission.",
    genres: ["Horror", "Sci-Fi"],
    runtimeMinutes: 117,
    votes: 950000,
  },
  {
    id: "tt0102926",
    title: "The Silence of the Lambs",
    poster: "https://m.media-amazon.com/images/M/MV5BNjNhZTk0ZmEtNjJhMi00YzFlLWE1MmEtYzM1M2ZmMGMwMTU4XkEyXkFqcGc@._V1_SX300.jpg",
    year: 1991,
    rating: 8.6,
    description: "A young F.B.I. cadet must receive the help of an incarcerated and manipulative cannibal killer to help catch another serial killer.",
    genres: ["Crime", "Drama", "Thriller"],
    runtimeMinutes: 118,
    votes: 1550000,
  },
];

// In-memory cache + in-flight de-duplication (per server instance).
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
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    return paginate(CURATED_MOVIES, page);
  }
  try {
    const path = process.env.IMDB_BROWSE_PATH ?? "/most-popular-movies";
    const all = await cached(`browse:${path}`, 10 * 60_000, async () =>
      dedupe(extractList(await imdb(path)).map(normalize).filter((m): m is Movie => m !== null)),
    );
    return paginate(all, page);
  } catch (err) {
    console.warn("RapidAPI browse error, falling back to curated movies:", err);
    return paginate(CURATED_MOVIES, page);
  }
}

export async function searchMovies(query: string, page: number): Promise<MoviePage> {
  const q = query.trim().toLowerCase();
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    const filtered = CURATED_MOVIES.filter(
      (m) => m.title.toLowerCase().includes(q) || m.genres.some((g) => g.toLowerCase().includes(q)),
    );
    return paginate(filtered, page);
  }
  try {
    const all = await cached(`search:${q}`, 5 * 60_000, async () =>
      dedupe(
        extractList(await imdb("/search", { type: "movie", primaryTitle: query.trim(), rows: String(SEARCH_FETCH_ROWS) }))
          .map(normalize)
          .filter((m): m is Movie => m !== null),
      ),
    );
    return paginate(all, page);
  } catch (err) {
    console.warn("RapidAPI search error, falling back to curated movies:", err);
    const filtered = CURATED_MOVIES.filter(
      (m) => m.title.toLowerCase().includes(q) || m.genres.some((g) => g.toLowerCase().includes(q)),
    );
    return paginate(filtered, page);
  }
}

export async function getMovieDetails(id: string): Promise<MovieDetails> {
  if (!/^tt\d{5,12}$/.test(id)) throw new AppError(400, "INVALID_MOVIE_ID", "That movie id isn't valid.");
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    const found = CURATED_MOVIES.find((m) => m.id === id);
    if (found) return found;
  }
  try {
    return await cached(`details:${id}`, 60 * 60_000, async () => {
      const raw = (await imdb(`/${id}`)) as RawMovie;
      const base = normalize(raw);
      if (!base) {
        const fallback = CURATED_MOVIES.find((m) => m.id === id);
        if (fallback) return fallback;
        throw new AppError(404, "MOVIE_NOT_FOUND", "Movie not found.");
      }
      return {
        ...base,
        description: str(raw.description),
        genres: Array.isArray(raw.genres) ? raw.genres.filter((g): g is string => typeof g === "string") : [],
        runtimeMinutes: num(raw.runtimeMinutes),
        votes: num(raw.numVotes),
      };
    });
  } catch (err) {
    const fallback = CURATED_MOVIES.find((m) => m.id === id);
    if (fallback) return fallback;
    throw err;
  }
}
