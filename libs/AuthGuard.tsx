"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

type AuthGuardProps = {
  children: React.ReactNode;
  cookieName: string;
  loginPath: string;
  defaultNextPath: string;
  storageKey?: string;
  fallback?: React.ReactNode;
};

function readCookie(name: string): string | null {
  const parts = document.cookie.split(";").map((v) => v.trim());
  for (const p of parts) {
    if (!p.startsWith(`${name}=`)) continue;
    const value = decodeURIComponent(p.slice(name.length + 1)).trim();
    return value ? value : null;
  }
  return null;
}

function readStorage(key: string): string | null {
  const fromLocal = window.localStorage.getItem(key);
  const fromSession = window.sessionStorage.getItem(key);
  const raw = (fromLocal ?? fromSession ?? "").trim();
  return raw ? raw : null;
}

function safeNextPath(pathname: string): string {
  const n = pathname.trim();
  if (!n.startsWith("/")) return "/";
  if (n.startsWith("//")) return "/";
  if (n.startsWith("/api")) return "/";
  if (n.startsWith("/_next")) return "/";
  return n;
}

export default function AuthGuard({
  children,
  cookieName,
  loginPath,
  defaultNextPath,
  storageKey,
  fallback,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    const cookieToken = readCookie(cookieName);
    const storageToken = storageKey ? readStorage(storageKey) : null;
    const token = cookieToken ?? storageToken;

    if (token) {
      setAuthed(true);
      setReady(true);
      return;
    }

    const nextPath = safeNextPath(pathname || defaultNextPath);
    const url = `${loginPath}?next=${encodeURIComponent(nextPath)}`;
    router.replace(url);
    setAuthed(false);
    setReady(true);
  }, [router, pathname, cookieName, loginPath, defaultNextPath, storageKey]);

  if (!ready) return fallback ?? null;
  if (!authed) return fallback ?? null;

  return <>{children}</>;
}