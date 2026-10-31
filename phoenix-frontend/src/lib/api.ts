"use client";

import { getCached, setCached, clearCache } from "./cache";

function resolveApiUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000";

  let url = raw.trim();

  // If protocol is missing, add https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, "");

  // If the host is a bare internal Render service name (e.g. phoenix-backend-0sdn)
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      parsed.hostname = `${parsed.hostname}.onrender.com`;
      url = parsed.origin;
    }
  } catch {
    // fallback
  }

  return url;
}

const API_URL = resolveApiUrl();

export const TOKEN_KEY = "phoenix.token";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("phoenix.token") || window.localStorage.getItem("phoenix_token");
}

export function setToken(value: string | null) {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem("phoenix.token", value);
    window.localStorage.setItem("phoenix_token", value);
  } else {
    window.localStorage.removeItem("phoenix.token");
    window.localStorage.removeItem("phoenix_token");
  }
}

export { clearCache };

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const cacheKey = path;

  if (method === "GET" && opts.cache) {
    const hit = getCached<T>(cacheKey);
    if (hit !== undefined) return hit;
  }

  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  if (res.status === 401) {
    setToken(null);
    clearCache();
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail) || detail;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  if (method === "GET" && opts.cache) setCached(cacheKey, data);
  return data;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message;
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 402) return "Not enough credits. Ask the workspace owner to top up.";
    if (err.status === 403) return "You don't have permission to do that.";
    if (err.status === 404) return "Not found (or you don't have access).";
    if (err.status >= 500) return "Server error. Please try again.";
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred.";
}
