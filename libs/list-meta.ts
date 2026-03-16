"use client";

export type ListPaginationMeta = {
  page: number;
  pageSize: number;
  totalData: number;
  totalPages: number;
};

export type ListSortMeta = {
  sortBy: string;
  sortOrder: "asc" | "desc";
};

export type ListMeta = {
  pagination?: ListPaginationMeta;
  sort?: ListSortMeta;
};

const LIST_META_KEY = "__satpam_list_meta__";

export function attachListMeta<T>(rows: T[], meta: ListMeta | null): T[] {
  if (!meta || typeof meta !== "object") return rows;
  Object.defineProperty(rows, LIST_META_KEY, {
    value: meta,
    configurable: true,
    enumerable: false,
    writable: true,
  });
  return rows;
}

export function readListMeta<T>(rows: readonly T[] | null | undefined): ListMeta | null {
  if (!rows || !Array.isArray(rows)) return null;
  const withMeta = rows as unknown as Record<string, unknown>;
  const meta = withMeta[LIST_META_KEY];
  if (!meta || typeof meta !== "object") return null;
  return meta as ListMeta;
}

export function extractListMetaFromEnvelope(raw: unknown): ListMeta | null {
  if (!raw || typeof raw !== "object") return null;

  const meta: ListMeta = {};

  const paginationRaw = (raw as { pagination?: unknown }).pagination;
  if (paginationRaw && typeof paginationRaw === "object") {
    const p = paginationRaw as Record<string, unknown>;
    const page = typeof p.page === "number" && Number.isFinite(p.page) ? Math.max(1, Math.floor(p.page)) : null;
    const pageSize = typeof p.pageSize === "number" && Number.isFinite(p.pageSize) ? Math.max(1, Math.floor(p.pageSize)) : null;
    const totalData = typeof p.totalData === "number" && Number.isFinite(p.totalData) ? Math.max(0, Math.floor(p.totalData)) : null;
    const totalPages = typeof p.totalPages === "number" && Number.isFinite(p.totalPages) ? Math.max(0, Math.floor(p.totalPages)) : null;

    if (page !== null && pageSize !== null && totalData !== null && totalPages !== null) {
      meta.pagination = { page, pageSize, totalData, totalPages };
    }
  }

  const sortRaw = (raw as { sort?: unknown }).sort;
  if (sortRaw && typeof sortRaw === "object") {
    const s = sortRaw as Record<string, unknown>;
    const sortBy = typeof s.sortBy === "string" ? s.sortBy.trim() : "";
    const sortOrderRaw = typeof s.sortOrder === "string" ? s.sortOrder.trim().toLowerCase() : "";
    if (sortBy && (sortOrderRaw === "asc" || sortOrderRaw === "desc")) {
      meta.sort = { sortBy, sortOrder: sortOrderRaw };
    }
  }

  return meta.pagination || meta.sort ? meta : null;
}

