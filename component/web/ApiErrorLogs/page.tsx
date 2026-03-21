"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";

import Button from "@/component/ui/Button";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import TextField from "@/component/ui/TextField";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import { listAPIErrorLogs, type APIErrorLog } from "@/repository/api-error-logs";
import { auth } from "@/repository";
import type { MeResponse } from "@/repository/auth";
import { readListMeta } from "@/libs/list-meta";

type SortColumn = "occurred_at" | "status_code" | "method" | "path";

const SORT_BY_MAP: Record<SortColumn, "occurredAt" | "statusCode" | "method" | "path"> = {
  occurred_at: "occurredAt",
  status_code: "statusCode",
  method: "method",
  path: "path",
};

type DetailState = APIErrorLog | null;

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function prettyJSON(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function statusTone(statusCode: number): string {
  if (statusCode >= 500) return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function getPlaceOptions(me: MeResponse | undefined, places: Place[]): Array<{ id: string; label: string }> {
  const accessRows = me?.placeAccesses ?? [];
  const accessMap = new Map(accessRows.map((row) => [row.placeId, `${row.placeName} (${row.placeCode})`] as const));

  if (places.length > 0) {
    if (accessMap.size === 0) {
      return places.map((row) => ({ id: row.id, label: `${row.place_name} (${row.place_code})` }));
    }
    return places
      .filter((row) => accessMap.has(row.id))
      .map((row) => ({ id: row.id, label: `${row.place_name} (${row.place_code})` }));
  }

  return accessRows.map((row) => ({ id: row.placeId, label: `${row.placeName} (${row.placeCode})` }));
}

export default function APIErrorLogsPage() {
  const meQuery = useQuery({
    queryKey: ["satpam-web-api-error-logs-me"],
    queryFn: () => auth.me(),
  });
  const placesQuery = placeHooks.useList({});

  const me = meQuery.data;
  const placeRows = React.useMemo(() => (placesQuery.data ?? []) as Place[], [placesQuery.data]);
  const placeOptions = React.useMemo(() => getPlaceOptions(me, placeRows), [me, placeRows]);
  const preferredPlaceId = String(me?.defaultPlaceId ?? me?.placeAccesses?.[0]?.placeId ?? "").trim();

  const [selectedPlaceId, setSelectedPlaceId] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [statusCode, setStatusCode] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<DetailState>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [tableState, setTableState] = React.useState({
    page: 1,
    pageSize: 15,
    sortKey: "occurred_at" as SortColumn,
    sortDirection: "desc" as "asc" | "desc",
  });

  React.useEffect(() => {
    const optionIds = new Set(placeOptions.map((row) => row.id));
    if (selectedPlaceId && optionIds.has(selectedPlaceId)) return;
    if (preferredPlaceId && optionIds.has(preferredPlaceId)) {
      setSelectedPlaceId(preferredPlaceId);
      return;
    }
    if (!selectedPlaceId) return;
    setSelectedPlaceId("");
  }, [placeOptions, preferredPlaceId, selectedPlaceId]);

  const listQuery = useQuery({
    queryKey: [
      "satpam-web-api-error-logs",
      selectedPlaceId,
      method,
      statusCode,
      fromDate,
      toDate,
      search,
      tableState.page,
      tableState.pageSize,
      tableState.sortKey,
      tableState.sortDirection,
    ],
    queryFn: () =>
      listAPIErrorLogs({
        placeId: selectedPlaceId || undefined,
        method: (method || undefined) as "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | undefined,
        statusCode: statusCode.trim() ? Number(statusCode) : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: search.trim() || undefined,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as APIErrorLog[], [listQuery.data]);
  const listMeta = React.useMemo(() => readListMeta(listQuery.data), [listQuery.data]);
  const pagination = React.useMemo(
    () => ({
      page: listMeta?.pagination?.page ?? tableState.page,
      pageSize: listMeta?.pagination?.pageSize ?? tableState.pageSize,
      totalData: listMeta?.pagination?.totalData ?? rows.length,
      totalPages: listMeta?.pagination?.totalPages ?? (rows.length > 0 ? 1 : 0),
    }),
    [
      listMeta?.pagination?.page,
      listMeta?.pagination?.pageSize,
      listMeta?.pagination?.totalData,
      listMeta?.pagination?.totalPages,
      rows.length,
      tableState.page,
      tableState.pageSize,
    ],
  );

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([meQuery.refetch(), placesQuery.refetch(), listQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [listQuery, meQuery, placesQuery]);

  const columns = React.useMemo<readonly MasterTableColumn<APIErrorLog>[]>(() => {
    return [
      {
        key: "occurred_at",
        header: "Waktu",
        sortable: true,
        className: "w-[190px]",
        render: (row) => formatDateTime(row.occurred_at),
      },
      {
        key: "status_code",
        header: "Status",
        sortable: true,
        className: "w-[110px]",
        render: (row) => (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.status_code)}`}>
            {row.status_code}
          </span>
        ),
      },
      {
        key: "method",
        header: "Method",
        sortable: true,
        className: "w-[100px]",
      },
      {
        key: "path",
        header: "Path",
        sortable: true,
        render: (row) => <span className="font-mono text-xs text-slate-700">{row.path}</span>,
      },
      {
        key: "message",
        header: "Message",
        render: (row) => row.message || "-",
      },
      {
        key: "place_id",
        header: "Place",
        render: (row) => row.place_id || "-",
      },
      {
        key: "id",
        header: "Detail",
        className: "w-[100px]",
        render: (row) => (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            onClick={() => setDetail(row)}
          >
            View
          </button>
        ),
      },
    ];
  }, []);

  const dataError = meQuery.error ?? placesQuery.error ?? listQuery.error;
  const isLoading = meQuery.isLoading || placesQuery.isLoading || listQuery.isLoading;

  return (
    <>
      <PageHeader
        title="API Error Logs"
        description="Log request API yang berakhir 4xx atau 5xx. Dipakai untuk tracing error production tanpa buka server log."
        actions={
          <Button variant="secondary" onClick={() => void onRefresh()} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <section className="app-glass rounded-[24px] p-4 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
            <select
              value={selectedPlaceId}
              onChange={(e) => {
                setSelectedPlaceId(e.target.value);
                setTableState((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
            >
              <option value="">Semua place</option>
              {placeOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-slate-800">Method</span>
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setTableState((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
            >
              <option value="">Semua</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <TextField
            label="Status Code"
            value={statusCode}
            onChange={(e) => {
              setStatusCode(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="409"
          />

          <TextField
            type="date"
            label="From Date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
          />

          <TextField
            type="date"
            label="To Date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
          />

          <TextField
            label="Search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="path atau message"
          />
        </div>
      </section>

      {dataError ? (
        <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
          {dataError instanceof Error ? dataError.message : "Gagal memuat API error logs."}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="app-glass rounded-[28px] p-5 shadow-[0_20px_42px_rgba(76,99,168,0.14)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monitoring</div>
              <div className="text-xl font-semibold text-slate-900">Error API terbaru</div>
            </div>
          </div>

          {isLoading ? (
            <LoadingStateCard title="Loading API error logs..." subtitle="Data log sedang dimuat dari backend." />
          ) : (
            <MasterTable
              columns={columns}
              data={rows}
              getRowKey={(row) => row.id}
              defaultPageSize={15}
              emptyMessage="Belum ada error API untuk filter yang dipilih."
              disableClientSearch
              serverPagination={{
                page: pagination.page,
                pageSize: pagination.pageSize,
                totalData: pagination.totalData,
                totalPages: pagination.totalPages,
                onPageChange: (page) => setTableState((prev) => ({ ...prev, page })),
                onPageSizeChange: (pageSize) => setTableState((prev) => ({ ...prev, page: 1, pageSize })),
              }}
              serverSorting={{
                sortKey: tableState.sortKey,
                sortDirection: tableState.sortDirection,
                onSortChange: (sortKey, sortDirection) => {
                  if (sortKey !== "occurred_at" && sortKey !== "status_code" && sortKey !== "method" && sortKey !== "path") return;
                  setTableState((prev) => ({ ...prev, page: 1, sortKey, sortDirection }));
                },
              }}
            />
          )}
        </div>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setDetail(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[28px] bg-white p-5 shadow-[0_32px_80px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">API Error Detail</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{detail.message || detail.path}</div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Waktu</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(detail.occurred_at)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {detail.method} {detail.path}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{detail.status_code}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Metadata</div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div><span className="font-semibold text-slate-900">ID:</span> {detail.id}</div>
                  <div><span className="font-semibold text-slate-900">Place:</span> {detail.place_id || "-"}</div>
                  <div><span className="font-semibold text-slate-900">User:</span> {detail.user_id || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Role:</span> {detail.user_role || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Client IP:</span> {detail.client_ip || "-"}</div>
                  <div><span className="font-semibold text-slate-900">User Agent:</span> {detail.user_agent || "-"}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Message</div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-xs text-slate-700">
                  {detail.message || "-"}
                </pre>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request Query</div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-xs text-slate-700">
                  {prettyJSON(detail.request_query)}
                </pre>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request Body</div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-xs text-slate-700">
                  {detail.request_body || "-"}
                </pre>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Response Body</div>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-xs text-slate-700">
                  {detail.response_body || "-"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
