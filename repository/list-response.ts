import type { HttpAgent } from "@/libs/http";
import { attachListMeta, extractListMetaFromEnvelope } from "@/libs/list-meta";

type QueryValue = string | number | boolean | null | undefined;
type QueryObject = Record<string, QueryValue>;

function extractListData<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== "object") return [];

  const data = (raw as { data?: unknown }).data;
  return Array.isArray(data) ? (data as T[]) : [];
}

function extractTotalPages(raw: unknown): number {
  const meta = extractListMetaFromEnvelope(raw);
  const totalPages = meta?.pagination?.totalPages;
  if (typeof totalPages !== "number" || !Number.isFinite(totalPages) || totalPages < 1) return 1;
  return Math.floor(totalPages);
}

function hasExplicitPagination(query: QueryObject): boolean {
  return query.page !== undefined || query.pageSize !== undefined;
}

export async function fetchAllListRows<T>(
  agent: HttpAgent,
  path: string,
  query: QueryObject = {},
): Promise<T[]> {
  const explicitPaging = hasExplicitPagination(query);
  const firstQuery = explicitPaging ? query : { ...query, page: 1, pageSize: 100 };
  const firstRaw = await agent.get<unknown>(path, { query: firstQuery });
  const firstData = extractListData<T>(firstRaw);
  const firstMeta = extractListMetaFromEnvelope(firstRaw);

  if (explicitPaging) return attachListMeta([...firstData], firstMeta);

  const totalPages = extractTotalPages(firstRaw);
  if (totalPages <= 1) {
    const fallbackMeta =
      firstMeta ??
      (firstData
        ? {
            pagination: {
              page: 1,
              pageSize: firstData.length || 1,
              totalData: firstData.length,
              totalPages: 1,
            },
          }
        : null);
    return attachListMeta([...firstData], fallbackMeta);
  }

  const all = [...firstData];
  for (let page = 2; page <= totalPages; page += 1) {
    const nextRaw = await agent.get<unknown>(path, {
      query: { ...query, page, pageSize: 100 },
    });
    all.push(...extractListData<T>(nextRaw));
  }

  return attachListMeta(all, {
    pagination: {
      page: 1,
      pageSize: all.length || 1,
      totalData: all.length,
      totalPages: 1,
    },
    sort: firstMeta?.sort,
  });
}
