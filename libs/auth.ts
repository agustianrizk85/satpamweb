import { getCookie, setCookie, delCookie } from "./cookies";

export type User = {
  id?: string | number;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  [k: string]: unknown;
};

export const TOKEN_KEY = "accessToken";
export const PETUGAS_TOKEN_KEY = "petugasAccessToken";
export const USER_KEY = "authUser";

export function saveSession(token: string, user?: User, rememberMe: boolean = true): void {
  setCookie(TOKEN_KEY, token, rememberMe ? 7 : undefined);

  if (user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  }
}

export function getToken(): string | null {
  const cookieToken = getCookie(TOKEN_KEY) ?? getCookie(PETUGAS_TOKEN_KEY) ?? null;
  if (cookieToken) return cookieToken;

  if (typeof window === "undefined") return null;

  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ??
      window.sessionStorage.getItem(TOKEN_KEY) ??
      window.localStorage.getItem(PETUGAS_TOKEN_KEY) ??
      window.sessionStorage.getItem(PETUGAS_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  delCookie(TOKEN_KEY);
  delCookie(PETUGAS_TOKEN_KEY);
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(PETUGAS_TOKEN_KEY);
    window.sessionStorage.removeItem(PETUGAS_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(USER_KEY);
  } catch {}
}
