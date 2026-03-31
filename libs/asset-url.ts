"use client";

const API_BASE_URL = String(
  process.env.NEXT_PUBLIC_ASSET_BASE ?? process.env.NEXT_PUBLIC_AUTH_BASE ?? process.env.AUTH_API_BASE ?? "",
).replace(/\/$/, "");

export function resolveAssetUrl(path: string | null | undefined): string {
  const value = String(path ?? "").trim();
  if (!value) return "";
  if (/^(?:https?:)?\/\//i.test(value)) return value;
  if (/^(?:data|blob):/i.test(value)) return value;
  if (!API_BASE_URL) return value;
  return value.startsWith("/") ? `${API_BASE_URL}${value}` : `${API_BASE_URL}/${value}`;
}
