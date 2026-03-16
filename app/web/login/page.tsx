import LoginPage from "@/component/web/login/LoginPage";

function resolveNextPath(next: string | null): string {
  const fallback = "/web/dashboard";
  if (!next) return fallback;

  const value = next.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.startsWith("/api")) return fallback;
  if (value.startsWith("/_next")) return fallback;
  if (value === "/web" || value === "/web/login" || value === "/mobile" || value === "/mobile/login") return fallback;

  return value;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const rawNext = typeof params.next === "string" ? params.next : null;
  const nextPath = resolveNextPath(rawNext);
  return <LoginPage nextPath={nextPath} />;
}
