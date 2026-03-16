export function setCookie(name: string, value: string, days?: number): void {
  if (typeof document === "undefined") return;

  const base = `${name}=${encodeURIComponent(value)};path=/;SameSite=Lax`;

  if (typeof days !== "number") {
    document.cookie = base;
    return;
  }

  const d = new Date();
  d.setTime(d.getTime() + days * 864e5);
  document.cookie = `${base};expires=${d.toUTCString()}`;
}

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const key = `${name}=`;
  const parts = document.cookie.split(";").map((s) => s.trim());

  for (const p of parts) {
    if (p.startsWith(key)) return decodeURIComponent(p.slice(key.length));
  }

  return undefined;
}

export function delCookie(name: string): void {
  if (typeof document === "undefined") return;

  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
}
