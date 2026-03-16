import { getToken as getSessionToken, clearSession } from "@/libs/auth";
import { setBackendStatus } from "@/libs/connectivity";

const API_BASE_URL = String(
  process.env.NEXT_PUBLIC_AUTH_BASE ?? process.env.AUTH_API_BASE ?? "",
).replace(/\/$/, "");

export type HttpOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class HttpError<T = unknown> extends Error {
  status: number;
  data: T | null;

  constructor(status: number, data: T | null, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

let isRedirectingForExpiredSession = false;

function extractMessage(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
  }
  return undefined;
}

function appendQuery(
  url: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!query) return url;

  const entries = Object.entries(query).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return url;

  const qs = new URLSearchParams();
  for (const [key, value] of entries) {
    qs.set(key, String(value));
  }

  const isAbsolute = /^https?:\/\//i.test(url);

  if (isAbsolute) {
    const u = new URL(url);
    const merged = new URLSearchParams(u.search);
    for (const [key, value] of qs.entries()) {
      merged.set(key, value);
    }
    u.search = merged.toString();
    return u.toString();
  }

  const [pathPart, existingQuery] = url.split("?", 2);
  const merged = new URLSearchParams(existingQuery ?? "");
  for (const [key, value] of qs.entries()) {
    merged.set(key, value);
  }
  const final = merged.toString();
  return final ? `${pathPart}?${final}` : pathPart;
}

function getAuthToken(): string | null {
  return getSessionToken();
}

function readErrorText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const fromMessage = typeof record.message === "string" ? record.message : "";
  const fromError = typeof record.error === "string" ? record.error : "";
  return (fromMessage || fromError).trim().toLowerCase();
}

function isExpiredTokenResponse(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  if (record.type === "token_expired") return true;

  const text = readErrorText(data);
  return text.includes("invalid or expired token") || text.includes("token expired");
}

function resolveLoginPath(pathname: string): string {
  if (pathname === "/mobile" || pathname.startsWith("/mobile/")) {
    return "/mobile/login";
  }
  return "/web/login";
}

function handleExpiredSessionRedirect() {
  if (typeof window === "undefined" || isRedirectingForExpiredSession) return;

  isRedirectingForExpiredSession = true;

  try {
    clearSession();
  } catch {
    // ignore
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const loginPath = resolveLoginPath(window.location.pathname);
  const loginUrl = new URL(loginPath, window.location.origin);
  loginUrl.searchParams.set("reason", "expired");

  if (currentPath && currentPath !== loginPath) {
    loginUrl.searchParams.set("next", currentPath);
  }

  window.location.replace(loginUrl.toString());
}

export async function http<T = unknown>(
  path: string,
  opts: HttpOptions = {},
): Promise<T> {
  const isAbsolute = /^https?:\/\//i.test(path);
  const base = isAbsolute ? path : `${API_BASE_URL}${path}`;
  const url = appendQuery(base || path, opts.query);

  const headers: Record<string, string> = {
    accept: "application/json",
    ...(opts.headers ?? {}),
  };

  if (opts.auth) {
    const token = getAuthToken();
    if (token && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const body =
    typeof opts.body === "string"
      ? opts.body
      : opts.body != null
        ? JSON.stringify(opts.body)
        : undefined;

  if (body && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  let res: Response;
  const timeoutMs =
    typeof opts.timeoutMs === "number"
      ? opts.timeoutMs
      : Number(process.env.NEXT_PUBLIC_HTTP_TIMEOUT_MS ?? 60000);

  const controller = opts.signal ? null : new AbortController();
  const timeoutId =
    controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body,
      cache: "no-store",
      signal: opts.signal ?? controller?.signal,
    });
    setBackendStatus("ok");
  } catch (e: unknown) {
    setBackendStatus("down");
    const msg = e instanceof Error ? e.message : "Network error";
    throw new HttpError(0, null, msg);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  let data: unknown = null;
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { message: text } : null;
    }
  } catch {
    // ignore parse error
  }

  if (!res.ok) {
    const msg = extractMessage(data) ?? `HTTP ${res.status}`;

    if (res.status === 401 && opts.auth && isExpiredTokenResponse(data)) {
      handleExpiredSessionRedirect();
    }

    throw new HttpError(res.status, data, msg);
  }

  return data as T;
}

export type HttpAgent = {
  get<T = unknown>(
    path?: string,
    opts?: Omit<HttpOptions, "method" | "body">,
  ): Promise<T>;
  post<T = unknown>(
    path: string,
    body?: unknown,
    opts?: Omit<HttpOptions, "method" | "body">,
  ): Promise<T>;
  put<T = unknown>(
    path: string,
    body?: unknown,
    opts?: Omit<HttpOptions, "method" | "body">,
  ): Promise<T>;
  patch<T = unknown>(
    path: string,
    body?: unknown,
    opts?: Omit<HttpOptions, "method" | "body">,
  ): Promise<T>;
  delete<T = unknown>(
    path: string,
    opts?: Omit<HttpOptions, "method" | "body">,
  ): Promise<T>;
};

export type HttpAgentOptions = {
  basePath: string;
  auth?: boolean;
  headers?: Record<string, string>;
};

function joinPath(basePath: string, subPath?: string): string {
  if (!subPath) return basePath;
  if (basePath.endsWith("/") && subPath.startsWith("/")) {
    return basePath + subPath.slice(1);
  }
  if (!basePath.endsWith("/") && !subPath.startsWith("/")) {
    return `${basePath}/${subPath}`;
  }
  return basePath + subPath;
}

export function createHttpAgent(options: HttpAgentOptions): HttpAgent {
  const { basePath, auth = false, headers: defaultHeaders } = options;

  return {
    get<T = unknown>(
      path: string = "",
      opts?: Omit<HttpOptions, "method" | "body">,
    ) {
      const fullPath = joinPath(basePath, path);
      return http<T>(fullPath, {
        ...opts,
        method: "GET",
        auth,
        headers: { ...(defaultHeaders ?? {}), ...(opts?.headers ?? {}) },
      });
    },

    post<T = unknown>(
      path: string,
      body?: unknown,
      opts?: Omit<HttpOptions, "method" | "body">,
    ) {
      const fullPath = joinPath(basePath, path);
      return http<T>(fullPath, {
        ...opts,
        method: "POST",
        body,
        auth,
        headers: { ...(defaultHeaders ?? {}), ...(opts?.headers ?? {}) },
      });
    },

    put<T = unknown>(
      path: string,
      body?: unknown,
      opts?: Omit<HttpOptions, "method" | "body">,
    ) {
      const fullPath = joinPath(basePath, path);
      return http<T>(fullPath, {
        ...opts,
        method: "PUT",
        body,
        auth,
        headers: { ...(defaultHeaders ?? {}), ...(opts?.headers ?? {}) },
      });
    },

    patch<T = unknown>(
      path: string,
      body?: unknown,
      opts?: Omit<HttpOptions, "method" | "body">,
    ) {
      const fullPath = joinPath(basePath, path);
      return http<T>(fullPath, {
        ...opts,
        method: "PATCH",
        body,
        auth,
        headers: { ...(defaultHeaders ?? {}), ...(opts?.headers ?? {}) },
      });
    },

    delete<T = unknown>(
      path: string,
      opts?: Omit<HttpOptions, "method" | "body">,
    ) {
      const fullPath = joinPath(basePath, path);
      return http<T>(fullPath, {
        ...opts,
        method: "DELETE",
        auth,
        headers: { ...(defaultHeaders ?? {}), ...(opts?.headers ?? {}) },
      });
    },
  };
}
