"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

type AdminGateProps = {
  children: React.ReactNode;
  redirectTo: string;
  cookieName?: string;
  storageKey?: string;
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
  const a = window.localStorage.getItem(key);
  const b = window.sessionStorage.getItem(key);
  const raw = (a ?? b ?? "").trim();
  return raw ? raw : null;
}

function buildRedirectUrl(redirectTo: string, nextPath: string): string {
  const base = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `${base}?next=${encodeURIComponent(next)}`;
}

export default function AdminGate({
  children,
  redirectTo,
  cookieName = "accessToken",
  storageKey = "accessToken",
}: AdminGateProps) {
  const router = useRouter();
  const pathname = usePathname() || "/web/dashboard";

  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const cookieToken = readCookie(cookieName);
    const storageToken = readStorage(storageKey);
    const token = cookieToken ?? storageToken;

    if (!token) {
      router.replace(buildRedirectUrl(redirectTo, pathname));
      return;
    }

    setReady(true);
  }, [router, pathname, redirectTo, cookieName, storageKey]);

  if (!ready) return null;
  return <>{children}</>;
}