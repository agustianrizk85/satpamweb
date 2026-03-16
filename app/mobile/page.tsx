import LoginPageMobile from "@/component/mobile/login/LoginPage";

function resolveNextPath(next: string | null): string {
  const fallback = "/mobile/dashboard";
  if (!next) return fallback;

  const value = next.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.startsWith("/api")) return fallback;
  if (value.startsWith("/_next")) return fallback;
  if (value === "/mobile" || value === "/mobile/login") return fallback;

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
  return <LoginPageMobile nextPath={nextPath} />;
}
