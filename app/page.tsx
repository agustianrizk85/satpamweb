import { headers } from "next/headers";
import { redirect } from "next/navigation";

function isMobileUserAgent(ua: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const force = typeof params.force === "string" ? params.force : undefined;
  if (force === "mobile") redirect("/mobile/login");
  if (force === "web") redirect("/web/login");

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  redirect(isMobileUserAgent(ua) ? "/mobile/login" : "/web/login");
}
