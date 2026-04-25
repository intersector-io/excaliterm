import { type Config } from "../config.js";

export interface ApiCallOptions {
  toolName: string;
  path: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  fetchImpl?: typeof fetch;
}

export async function apiCall<T>(
  config: Config,
  opts: ApiCallOptions,
): Promise<T> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = config.baseUrl.replace(/\/$/, "");
  const url = `${base}${opts.path}`;

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: opts.headers,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetchImpl(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `${opts.toolName}: HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
    );
  }
  return (await res.json()) as T;
}
