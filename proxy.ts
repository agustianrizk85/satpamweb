import { NextResponse, type NextRequest } from "next/server";

const USER_ROOT = "/web";
const USER_LOGIN = "/web/login";

const PETUGAS_ROOT = "/mobile";
const PETUGAS_LOGIN = "/mobile/login";

const USER_TOKEN_COOKIE = "accessToken";
const PETUGAS_TOKEN_COOKIE = "petugasAccessToken";

function isBypass(pathname: string): boolean {
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.[^/]+$/.test(pathname)) return true; // public static assets, e.g. /logo.jpeg
  return false;
}

function isPetugasArea(pathname: string): boolean {
  return (
    pathname === PETUGAS_ROOT ||
    pathname.startsWith(`${PETUGAS_ROOT}/`) ||
    pathname === "/petugas" ||
    pathname.startsWith("/petugas/")
  );
}

function isLoginLike(pathname: string): boolean {
  return pathname === USER_ROOT || pathname === USER_LOGIN || pathname === PETUGAS_ROOT || pathname === PETUGAS_LOGIN;
}

function safeNextPath(nextRaw: string | null): string | null {
  if (!nextRaw) return null;
  const n = nextRaw.trim();
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api")) return null;
  if (n.startsWith("/_next")) return null;
  if (isLoginLike(n)) return null;
  return n;
}

function isPublic(pathname: string): boolean {
  if (isBypass(pathname)) return true;
  if (isLoginLike(pathname)) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isBypass(pathname)) return NextResponse.next();

  const petugas = isPetugasArea(pathname);
  const cookieName = petugas ? PETUGAS_TOKEN_COOKIE : USER_TOKEN_COOKIE;
  const token = req.cookies.get(cookieName)?.value ?? "";

  if (isPublic(pathname)) {
    if (token && isLoginLike(pathname)) {
      const nextParam = safeNextPath(req.nextUrl.searchParams.get("next"));
      const url = req.nextUrl.clone();
      url.pathname = nextParam ?? (petugas ? `${PETUGAS_ROOT}/dashboard` : `${USER_ROOT}/dashboard`);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = petugas ? PETUGAS_LOGIN : USER_LOGIN;
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
