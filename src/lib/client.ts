// Browser-side fetch helper. Never throws on HTTP errors; callers branch on `ok`.
export type ApiResult<T = any> = { ok: boolean; status: number; data: T };

export async function api<T = any>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { ok: false, status: 0, data: { error: { code: "NETWORK", message: "You appear to be offline. Check your connection." } } as T };
  }
}

export const errorMessage = (r: ApiResult): string => r.data?.error?.message ?? "Something went wrong. Try again.";
export const fieldErrors = (r: ApiResult): Record<string, string[]> => r.data?.error?.fields ?? {};
