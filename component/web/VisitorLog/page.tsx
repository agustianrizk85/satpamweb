"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { readListMeta } from "@/libs/list-meta";
import Button from "@/component/ui/Button";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { MeResponse } from "@/repository/auth";
import { me as getMe } from "@/repository/auth";
import { downloadVisitorReportCsv, listVisitorReports } from "@/repository/reports";
import type { ReportDownloadFormat, VisitorReportRow } from "@/repository/reports";

type VisitorSortColumn = "created_at" | "updated_at" | "nik" | "nama";

const VISITOR_SORT_BY_MAP: Record<VisitorSortColumn, "createdAt" | "updatedAt" | "nik" | "nama"> = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  nik: "nik",
  nama: "nama",
};

type AuthSessionUser = {
  id?: string | number;
  fullName?: string;
  username?: string;
  role?: string;
  defaultPlaceId?: string | null;
  placeAccesses?: Array<{ placeId: string }>;
};

function readAuthSessionUser(): AuthSessionUser | null {
  if (typeof window === "undefined") return null;

  const parseFrom = (storage: Storage): AuthSessionUser | null => {
    const raw = storage.getItem("authUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AuthSessionUser;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  return parseFrom(window.localStorage) ?? parseFrom(window.sessionStorage);
}

function formatDateTime(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed).replace(/\./g, ":") + " WIB";
}

export default function VisitorLogPage() {
  const authUserFromStorage = React.useMemo(() => readAuthSessionUser(), []);
  const needsMeFetch = !authUserFromStorage;
  const meQuery = useQuery({
    queryKey: ["satpam-auth-me-visitors"],
    queryFn: async () => getMe(),
    enabled: needsMeFetch,
  });
  const authUser = React.useMemo<AuthSessionUser | null>(() => {
    if (authUserFromStorage) return authUserFromStorage;
    const me = meQuery.data as MeResponse | undefined;
    if (!me) return null;
    return {
      id: me.id,
      fullName: me.fullName,
      username: me.username,
      role: me.role,
      defaultPlaceId: me.defaultPlaceId,
      placeAccesses: me.placeAccesses,
    };
  }, [authUserFromStorage, meQuery.data]);

  const roleCode = String(authUser?.role ?? "").trim().toUpperCase();
  const isGuard = roleCode === "GUARD";
  const authReady = Boolean(authUser) || !needsMeFetch || Boolean(meQuery.error);
  const canLoadUsers = authReady && !isGuard;
  const ownUserId = authUser?.id != null ? String(authUser.id).trim() : "";
  const ownDefaultPlaceId = String(authUser?.defaultPlaceId ?? "").trim();
  const ownFirstAccessPlaceId = String(authUser?.placeAccesses?.[0]?.placeId ?? "").trim();
  const preferredPlaceId = ownDefaultPlaceId || ownFirstAccessPlaceId;

  const places = placeHooks.useList({});
  const users = userHooks.useList({}, { enabled: canLoadUsers });

  const [filterPlaceId, setFilterPlaceId] = React.useState("");
  const [filterUserId, setFilterUserId] = React.useState("");
  const [filterNik, setFilterNik] = React.useState("");
  const [filterNama, setFilterNama] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [reportFormat, setReportFormat] = React.useState<ReportDownloadFormat>("pdf");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: VisitorSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "created_at",
    sortDirection: "desc",
  });

  const effectiveFilterUserId = (isGuard ? ownUserId : filterUserId).trim();
  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const userRows = React.useMemo(() => (users.data ?? []) as User[], [users.data]);

  React.useEffect(() => {
    if (!isGuard) return;
    if (filterPlaceId.trim()) return;
    if (preferredPlaceId && placeRows.some((p) => p.id === preferredPlaceId)) {
      setFilterPlaceId(preferredPlaceId);
      return;
    }
    if (placeRows[0]?.id) setFilterPlaceId(placeRows[0].id);
  }, [filterPlaceId, isGuard, placeRows, preferredPlaceId]);

  React.useEffect(() => {
    if (!isGuard || !ownUserId) return;
    if (filterUserId !== ownUserId) setFilterUserId(ownUserId);
  }, [filterUserId, isGuard, ownUserId]);

  const list = useQuery({
    queryKey: ["satpam-visitor-report", filterPlaceId, effectiveFilterUserId, fromDate, toDate, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: () =>
      listVisitorReports({
        placeId: filterPlaceId.trim() ? filterPlaceId : undefined,
        userId: effectiveFilterUserId || undefined,
        fromDate: fromDate.trim() || undefined,
        toDate: toDate.trim() || undefined,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: VISITOR_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
  });

  const rawRows = React.useMemo(() => ((list.data?.data ?? []) as VisitorReportRow[]), [list.data?.data]);
  const rows = React.useMemo(
    () =>
      rawRows.filter((row) => {
        const nikOk = !filterNik.trim() || row.nik.toLowerCase().includes(filterNik.trim().toLowerCase());
        const namaOk = !filterNama.trim() || row.nama.toLowerCase().includes(filterNama.trim().toLowerCase());
        return nikOk && namaOk;
      }),
    [filterNama, filterNik, rawRows],
  );

  const listMeta = React.useMemo(() => readListMeta(list.data?.data), [list.data?.data]);
  const pagination = React.useMemo(
    () => ({
      page: list.data?.pagination?.page ?? listMeta?.pagination?.page ?? tableState.page,
      pageSize: list.data?.pagination?.pageSize ?? listMeta?.pagination?.pageSize ?? tableState.pageSize,
      totalData: list.data?.pagination?.totalData ?? listMeta?.pagination?.totalData ?? rawRows.length,
      totalPages: list.data?.pagination?.totalPages ?? listMeta?.pagination?.totalPages ?? (rawRows.length > 0 ? 1 : 0),
    }),
    [list.data?.pagination?.page, list.data?.pagination?.pageSize, list.data?.pagination?.totalData, list.data?.pagination?.totalPages, listMeta?.pagination?.page, listMeta?.pagination?.pageSize, listMeta?.pagination?.totalData, listMeta?.pagination?.totalPages, rawRows.length, tableState.page, tableState.pageSize],
  );

  const placeNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of placeRows) map.set(p.id, `${p.place_name ?? p.place_code}`);
    return map;
  }, [placeRows]);

  const userNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of userRows) map.set(u.id, u.full_name ?? u.username ?? u.id);
    return map;
  }, [userRows]);

  const columns = React.useMemo<readonly MasterTableColumn<VisitorReportRow>[]>(() => {
    return [
      { key: "created_at", header: "Created", sortable: true, className: "w-[180px]", render: (r) => formatDateTime(r.created_at) },
      { key: "place_id", header: "Place", className: "w-[180px]", render: (r) => placeNameById.get(r.place_id) ?? r.place_id },
      { key: "user_id", header: "User", className: "w-[180px]", render: (r) => userNameById.get(r.user_id) ?? r.user_id },
      { key: "nik", header: "NIK", sortable: true, className: "w-[170px]" },
      { key: "nama", header: "Nama", sortable: true, className: "w-[220px]" },
      { key: "tujuan", header: "Tujuan", className: "min-w-[220px]", render: (r) => r.tujuan?.trim() || "-" },
      { key: "catatan", header: "Catatan", className: "min-w-[220px]", render: (r) => r.catatan?.trim() || "-" },
    ];
  }, [placeNameById, userNameById]);

  const authLoading = needsMeFetch && meQuery.isLoading;
  const authError = meQuery.error;

  return (
    <>
      <PageHeader
        title="Visitor Log"
        description="Daftar log visitor per place."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value as ReportDownloadFormat)}
              className="rounded-lg border border-transparent bg-slate-100 px-3 py-2 text-[13px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  setIsDownloading(true);
                  await downloadVisitorReportCsv(
                    {
                      placeId: filterPlaceId.trim() ? filterPlaceId : undefined,
                      userId: effectiveFilterUserId || undefined,
                      fromDate: fromDate.trim() || undefined,
                      toDate: toDate.trim() || undefined,
                    },
                    reportFormat,
                  );
                } finally {
                  setIsDownloading(false);
                }
              }}
              disabled={isDownloading}
            >
              {isDownloading ? "Downloading..." : reportFormat === "pdf" ? "Download PDF" : "Download CSV"}
            </Button>
          </div>
        }
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] sm:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select
            value={filterPlaceId}
            onChange={(e) => {
              setFilterPlaceId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            {!isGuard ? <option value="">All</option> : null}
            {placeRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.place_name} ({p.place_code})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">User</span>
          <select
            value={filterUserId}
            onChange={(e) => {
              setFilterUserId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            disabled={isGuard}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            {!isGuard ? <option value="">All</option> : null}
            {userRows.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.username})
              </option>
            ))}
          </select>
        </label>

        <TextField
          label="Filter NIK"
          value={filterNik}
          onChange={(e) => setFilterNik(e.target.value)}
        />

        <TextField
          label="Filter Nama"
          value={filterNama}
          onChange={(e) => setFilterNama(e.target.value)}
        />
        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setTableState((prev) => ({ ...prev, page: 1 }));
          }}
        />
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setTableState((prev) => ({ ...prev, page: 1 }));
          }}
        />
      </div>

      <div className="space-y-3">
        {authLoading ? (
          <LoadingStateCard title="Loading session..." subtitle="Memuat sesi dan akses visitor log." />
        ) : authError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {authError instanceof Error ? authError.message : "Gagal load session."}
          </div>
        ) : list.isLoading ? (
          <LoadingStateCard title="Loading visitor log..." subtitle="Data visitor sedang dimuat." />
        ) : list.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {list.error instanceof Error ? list.error.message : "Gagal load data."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(r) => r.id}
            defaultPageSize={10}
            emptyMessage="Belum ada data visitor."
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
                if (sortKey !== "created_at" && sortKey !== "updated_at" && sortKey !== "nik" && sortKey !== "nama") return;
                setTableState((prev) => ({ ...prev, page: 1, sortKey: sortKey as VisitorSortColumn, sortDirection }));
              },
            }}
          />
        )}
      </div>
    </>
  );
}
