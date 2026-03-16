"use client";

import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { HttpAgent, HttpOptions } from "@/libs/http";
import { attachListMeta, extractListMetaFromEnvelope } from "@/libs/list-meta";

type QueryObject = NonNullable<HttpOptions["query"]>;

type ListConfig<TList, TListParams extends QueryObject> = {
  mapParams?: (params: TListParams) => QueryObject;
  defaultOptions?: Omit<UseQueryOptions<TList, Error>, "queryKey" | "queryFn">;
};

type DetailConfig<TDetail> = {
  defaultOptions?: Omit<UseQueryOptions<TDetail, Error>, "queryKey" | "queryFn">;
};

type CreateConfig<TRow, TCreate> = {
  defaultOptions?: Omit<UseMutationOptions<TRow, unknown, TCreate>, "mutationFn" | "onSuccess">;
  onSuccess?: (
    data: TRow,
    variables: TCreate,
    helpers: { queryClient: ReturnType<typeof useQueryClient> }
  ) => void;
};

type UpdateConfig<TRow, TUpdate, TId> = {
  defaultOptions?: Omit<
    UseMutationOptions<TRow, unknown, { id: TId; data: TUpdate }>,
    "mutationFn" | "onSuccess"
  >;
  onSuccess?: (
    data: TRow,
    variables: { id: TId; data: TUpdate },
    helpers: { queryClient: ReturnType<typeof useQueryClient> }
  ) => void;
};

type BulkUpdateConfig<TRow, TBulk> = {
  path?: string;
  method?: "put" | "patch" | "post";
  defaultOptions?: Omit<UseMutationOptions<TRow, unknown, TBulk>, "mutationFn" | "onSuccess">;
  onSuccess?: (
    data: TRow,
    variables: TBulk,
    helpers: { queryClient: ReturnType<typeof useQueryClient> }
  ) => void;
};

type RemoveConfig<TId> = {
  defaultOptions?: Omit<UseMutationOptions<void, unknown, TId>, "mutationFn" | "onSuccess">;
  onSuccess?: (
    _data: void,
    id: TId,
    helpers: { queryClient: ReturnType<typeof useQueryClient> }
  ) => void;
};

type FilterConfig<TFilterList, TFilterParams extends QueryObject, TFilterBody> = {
  path?: string;
  method?: "post" | "get";
  mapParams?: (params: TFilterParams) => QueryObject;
  serializeParams?: (params: TFilterParams) => string;
  serializeBody?: (body: TFilterBody) => string;
  selectData?: (res: unknown) => TFilterList;
  keepPreviousData?: boolean;
  defaultOptions?: Omit<UseQueryOptions<TFilterList, Error>, "queryKey" | "queryFn">;
};

function stableStringifyDeep(v: unknown): string {
  const seen = new WeakSet<object>();

  const norm = (x: unknown): unknown => {
    if (x === null || x === undefined) return null;
    if (typeof x !== "object") return x;
    if (x instanceof Date) return x.toISOString();
    if (Array.isArray(x)) return x.map(norm);

    if (seen.has(x)) return "[Circular]";
    seen.add(x as object);

    const obj = x as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = norm(obj[k]);
    return out;
  };

  try {
    return JSON.stringify(norm(v));
  } catch {
    try {
      return JSON.stringify(v ?? null);
    } catch {
      return String(v);
    }
  }
}

function toQueryString(query: unknown): string {
  if (!query) return "";
  if (typeof query === "string") return query.replace(/^\?/, "");
  if (query instanceof URLSearchParams) return query.toString();

  const sp = new URLSearchParams();
  if (typeof query === "object") {
    for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item === undefined || item === null || item === "") continue;
          sp.append(k, String(item));
        }
      } else {
        sp.set(k, String(v));
      }
    }
  }
  return sp.toString();
}

function unwrapData<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in (res as Record<string, unknown>)) {
    const withData = res as { data?: T };
    if (withData.data !== undefined) return withData.data;
  }
  return res as T;
}

function getTotalPagesFromListEnvelope(res: unknown): number {
  const meta = extractListMetaFromEnvelope(res);
  const totalPages = meta?.pagination?.totalPages;
  if (typeof totalPages !== "number" || !Number.isFinite(totalPages) || totalPages < 1) return 1;
  return Math.floor(totalPages);
}

function hasExplicitPagination(query: QueryObject): boolean {
  return query.page !== undefined || query.pageSize !== undefined;
}

function createCrudHooksCore<
  TList,
  TRow,
  TCreate,
  TUpdate,
  TId,
  TListParams extends QueryObject,
  TDetail,
  TFilterList,
  TFilterParams extends QueryObject,
  TFilterBody,
  TBulkUpdate
>(opts: {
  agent: HttpAgent;
  key: string;
  listConfig?: ListConfig<TList, TListParams>;
  detailConfig?: DetailConfig<TDetail>;
  createConfig?: CreateConfig<TRow, TCreate>;
  updateConfig?: UpdateConfig<TRow, TUpdate, TId>;
  bulkUpdateConfig?: BulkUpdateConfig<TRow, TBulkUpdate>;
  removeConfig?: RemoveConfig<TId>;
  filterConfig?: FilterConfig<TFilterList, TFilterParams, TFilterBody>;
}) {
  const {
    agent,
    key,
    listConfig,
    detailConfig,
    createConfig,
    updateConfig,
    bulkUpdateConfig,
    removeConfig,
    filterConfig,
  } = opts;

  function useList(
    params: TListParams,
    options?: Omit<UseQueryOptions<TList, Error>, "queryKey" | "queryFn">
  ) {
    const query = listConfig?.mapParams ? listConfig.mapParams(params) : (params as QueryObject);

    return useQuery<TList, Error>({
      queryKey: [key, { ...params }],
      queryFn: async () => {
        const explicitPaging = hasExplicitPagination(query);
        const firstQuery = explicitPaging ? query : { ...query, page: 1, pageSize: 100 };
        const firstRaw = await agent.get<unknown>("", { query: firstQuery });
        const firstData = unwrapData<TList>(firstRaw);
        const firstMeta = extractListMetaFromEnvelope(firstRaw);

        if (!Array.isArray(firstData)) return firstData;

        if (explicitPaging) {
          return attachListMeta([...firstData], firstMeta) as TList;
        }

        const totalPages = getTotalPagesFromListEnvelope(firstRaw);
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
          return attachListMeta([...firstData], fallbackMeta) as TList;
        }

        const merged = [...firstData];
        for (let page = 2; page <= totalPages; page += 1) {
          const nextRaw = await agent.get<unknown>("", {
            query: { ...query, page, pageSize: 100 },
          });
          const nextData = unwrapData<unknown>(nextRaw);
          if (Array.isArray(nextData)) merged.push(...nextData);
        }

        return attachListMeta(merged, {
          pagination: {
            page: 1,
            pageSize: merged.length || 1,
            totalData: merged.length,
            totalPages: 1,
          },
          sort: firstMeta?.sort,
        }) as TList;
      },
      ...(listConfig?.defaultOptions ?? {}),
      ...(options ?? {}),
    });
  }

  function useDetail(
    id: TId | null,
    options?: Omit<UseQueryOptions<TDetail, Error>, "queryKey" | "queryFn">
  ) {
    return useQuery<TDetail, Error>({
      queryKey: [key, "detail", id],
      queryFn: () => {
        if (!id) throw new Error("id is required");
        return agent.get<TDetail>(`/${String(id)}`);
      },
      enabled: !!id,
      ...(detailConfig?.defaultOptions ?? {}),
      ...(options ?? {}),
    });
  }

  function useCreate(
    options?: Omit<UseMutationOptions<TRow, unknown, TCreate>, "mutationFn" | "onSuccess">
  ) {
    const qc = useQueryClient();
    const baseOptions = { ...(createConfig?.defaultOptions ?? {}), ...(options ?? {}) };

    return useMutation<TRow, unknown, TCreate>({
      ...baseOptions,
      mutationFn: (payload) => agent.post<TRow>("", payload),
      onSuccess: (data, variables) => {
        qc.invalidateQueries({ queryKey: [key] });
        createConfig?.onSuccess?.(data, variables, { queryClient: qc });
      },
    });
  }

  function useUpdate(
    options?: Omit<
      UseMutationOptions<TRow, unknown, { id: TId; data: TUpdate }>,
      "mutationFn" | "onSuccess"
    >
  ) {
    const qc = useQueryClient();
    const baseOptions = { ...(updateConfig?.defaultOptions ?? {}), ...(options ?? {}) };

    return useMutation<TRow, unknown, { id: TId; data: TUpdate }>({
      ...baseOptions,
      mutationFn: ({ id, data }) => agent.patch<TRow>(`/${String(id)}`, data),
      onSuccess: (data, variables) => {
        qc.invalidateQueries({ queryKey: [key] });
        qc.invalidateQueries({ queryKey: [key, "detail", variables.id] });
        updateConfig?.onSuccess?.(data, variables, { queryClient: qc });
      },
    });
  }

  function useBulkUpdate(
    options?: Omit<UseMutationOptions<TRow, unknown, TBulkUpdate>, "mutationFn" | "onSuccess">
  ) {
    if (!bulkUpdateConfig) {
      throw new Error(`bulkUpdateConfig is required for ${key}.useBulkUpdate`);
    }

    const qc = useQueryClient();
    const baseOptions = { ...(bulkUpdateConfig.defaultOptions ?? {}), ...(options ?? {}) };

    const path = bulkUpdateConfig.path ?? "";
    const method = bulkUpdateConfig.method ?? "put";

    return useMutation<TRow, unknown, TBulkUpdate>({
      ...baseOptions,
      mutationFn: (payload) => {
        if (method === "post") return agent.post<TRow>(path, payload);
        if (method === "patch") return agent.patch<TRow>(path, payload);
        return agent.put<TRow>(path, payload);
      },
      onSuccess: (data, variables) => {
        qc.invalidateQueries({ queryKey: [key] });
        bulkUpdateConfig.onSuccess?.(data, variables, { queryClient: qc });
      },
    });
  }

  function useRemove(
    options?: Omit<UseMutationOptions<void, unknown, TId>, "mutationFn" | "onSuccess">
  ) {
    const qc = useQueryClient();
    const baseOptions = { ...(removeConfig?.defaultOptions ?? {}), ...(options ?? {}) };

    return useMutation<void, unknown, TId>({
      ...baseOptions,
      mutationFn: (id) => agent.delete<void>(`/${String(id)}`),
      onSuccess: (_data, rid) => {
        qc.invalidateQueries({ queryKey: [key] });
        removeConfig?.onSuccess?.(_data, rid, { queryClient: qc });
      },
    });
  }

  function useFilters(
    params: TFilterParams,
    body: TFilterBody,
    options?: Omit<UseQueryOptions<TFilterList, Error>, "queryKey" | "queryFn">
  ) {
    if (!filterConfig) {
      throw new Error(`filterConfig is required for ${key}.useFilters`);
    }

    const path = filterConfig.path ?? "/filters";
    const method = filterConfig.method ?? "post";
    const queryObj = filterConfig.mapParams ? filterConfig.mapParams(params) : (params as QueryObject);

    const paramsKey = useMemo(
      () => (filterConfig.serializeParams ? filterConfig.serializeParams(params) : stableStringifyDeep(params)),
      [params]
    );

    const bodyKey = useMemo(
      () => (filterConfig.serializeBody ? filterConfig.serializeBody(body) : stableStringifyDeep(body)),
      [body]
    );

    const queryKey = useMemo(() => [key, "filters", paramsKey, bodyKey], [paramsKey, bodyKey]);

    const keepPrev = filterConfig.keepPreviousData ?? true;
    const selectData = filterConfig.selectData ?? ((r: unknown) => unwrapData<TFilterList>(r));

    return useQuery<TFilterList, Error>({
      queryKey,
      placeholderData: keepPrev ? (prev) => prev : undefined,
      queryFn: async () => {
        const qs = toQueryString(queryObj);
        const url = qs ? `${path}?${qs}` : path;

        if (method === "get") {
          const res = await agent.get<TFilterList>(url);
          return selectData(res);
        }

        const res = await agent.post<TFilterList>(url, body);
        return selectData(res);
      },
      ...(filterConfig.defaultOptions ?? {}),
      ...(options ?? {}),
    });
  }

  return {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useBulkUpdate,
    useRemove,
    useFilters,
  };
}

export function createCrudHooks<
  TList,
  TRow,
  TCreate,
  TUpdate,
  TId = string,
  TListParams extends QueryObject = QueryObject,
  TFilterList = TList,
  TFilterParams extends QueryObject = TListParams,
  TFilterBody = unknown,
  TBulkUpdate = never
>(opts: {
  agent: HttpAgent;
  key: string;
  listConfig?: ListConfig<TList, TListParams>;
  detailConfig?: DetailConfig<TRow>;
  createConfig?: CreateConfig<TRow, TCreate>;
  updateConfig?: UpdateConfig<TRow, TUpdate, TId>;
  bulkUpdateConfig?: BulkUpdateConfig<TRow, TBulkUpdate>;
  removeConfig?: RemoveConfig<TId>;
  filterConfig?: FilterConfig<TFilterList, TFilterParams, TFilterBody>;
}) {
  return createCrudHooksCore<
    TList,
    TRow,
    TCreate,
    TUpdate,
    TId,
    TListParams,
    TRow,
    TFilterList,
    TFilterParams,
    TFilterBody,
    TBulkUpdate
  >(opts);
}

export function createCrudHooksV2<
  TList,
  TRow,
  TCreate,
  TUpdate,
  TId = string,
  TListParams extends QueryObject = QueryObject,
  TDetail = TRow,
  TFilterList = TList,
  TFilterParams extends QueryObject = TListParams,
  TFilterBody = unknown,
  TBulkUpdate = never
>(opts: {
  agent: HttpAgent;
  key: string;
  listConfig?: ListConfig<TList, TListParams>;
  detailConfig?: DetailConfig<TDetail>;
  createConfig?: CreateConfig<TRow, TCreate>;
  updateConfig?: UpdateConfig<TRow, TUpdate, TId>;
  bulkUpdateConfig?: BulkUpdateConfig<TRow, TBulkUpdate>;
  removeConfig?: RemoveConfig<TId>;
  filterConfig?: FilterConfig<TFilterList, TFilterParams, TFilterBody>;
}) {
  return createCrudHooksCore<
    TList,
    TRow,
    TCreate,
    TUpdate,
    TId,
    TListParams,
    TDetail,
    TFilterList,
    TFilterParams,
    TFilterBody,
    TBulkUpdate
  >(opts);
}
