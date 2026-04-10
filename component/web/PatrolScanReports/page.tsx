"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import DateHighlightField from "@/component/ui/DateHighlightField";
import DownloadProgressModal from "@/component/ui/DownloadProgressModal";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { estimateDataUrlSizeBytes, formatBytesToKB } from "@/libs/image";
import { resolveAssetUrl } from "@/libs/asset-url";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { Shift } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { MeResponse } from "@/repository/auth";
import { me as getMe } from "@/repository/auth";
import { deletePatrolScan } from "@/repository/patrol-scans";
import {
  downloadPatrolScanReportCsv,
  listPatrolScanReportDates,
  listPatrolScanReportRounds,
  listPatrolScanReports,
} from "@/repository/reports";
import type { PatrolScanReportRow, ReportDownloadFormat } from "@/repository/reports";

type PatrolScanReportSortColumn = "scanned_at" | "spot_name" | "user_name" | "shift_name" | "note";

const PATROL_SCAN_REPORT_SORT_BY_MAP: Record<PatrolScanReportSortColumn, "scannedAt" | "spotName" | "userName" | "placeName"> = {
  scanned_at: "scannedAt",
  spot_name: "spotName",
  user_name: "userName",
  shift_name: "placeName",
  note: "scannedAt",
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

function toDateOnly(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (direct?.[0]) return direct[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatDateTime(value: string | null | undefined): string {
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

function formatRoundLabel(roundNo: number | null | undefined): string {
  return Number(roundNo) === 0 ? "Tanpa Ronde" : `Ronde ${roundNo ?? "-"}`;
}

export default function PatrolScanReportsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const authUserFromStorage = React.useMemo(() => readAuthSessionUser(), []);
  const needsMeFetch = !authUserFromStorage;
  const meQuery = useQuery({
    queryKey: ["satpam-auth-me-patrol-scan-reports"],
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
  const canManageOperational = roleCode === "SUPER_ADMIN";
  const ownUserId = authUser?.id != null ? String(authUser.id).trim() : "";
  const ownDefaultPlaceId = String(authUser?.defaultPlaceId ?? "").trim();
  const ownFirstAccessPlaceId = String(authUser?.placeAccesses?.[0]?.placeId ?? "").trim();
  const preferredPlaceId = ownDefaultPlaceId || ownFirstAccessPlaceId;

  const places = placeHooks.useList({});
  const users = userHooks.useList({}, { enabled: !isGuard });
  const shifts = shiftHooks.useList({});
  const [placeId, setPlaceId] = React.useState("");
  const [filterUserId, setFilterUserId] = React.useState("");
  const [reportShiftId, setReportShiftId] = React.useState("");
  const [filterRoundNo, setFilterRoundNo] = React.useState("");
  const [reportFromDate, setReportFromDate] = React.useState("");
  const [reportToDate, setReportToDate] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    sortKey: PatrolScanReportSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    sortKey: "scanned_at",
    sortDirection: "desc",
  });
  const [reportCalendarMonth, setReportCalendarMonth] = React.useState(() => toDateOnly(new Date().toISOString()).slice(0, 7));
  const [reportFormat, setReportFormat] = React.useState<ReportDownloadFormat>("pdf");
  const [isDownloadingReport, setIsDownloadingReport] = React.useState(false);
  const [downloadProgressOpen, setDownloadProgressOpen] = React.useState(false);
  const [downloadProgressPercent, setDownloadProgressPercent] = React.useState(0);
  const [downloadLoadedBytes, setDownloadLoadedBytes] = React.useState(0);
  const [downloadTotalBytes, setDownloadTotalBytes] = React.useState<number | null>(null);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [previewPhotoUrl, setPreviewPhotoUrl] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PatrolScanReportRow | null>(null);
  const progressTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const transferStartedRef = React.useRef(false);
  const effectiveFilterUserId = (isGuard ? ownUserId : filterUserId).trim();

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const userRows = React.useMemo(() => {
    if (!isGuard) return (users.data ?? []) as User[];
    if (!ownUserId) return [] as User[];
    return [{
      id: ownUserId,
      role: { id: "", code: "GUARD", name: "Petugas" },
      full_name: authUser?.fullName ?? authUser?.username ?? ownUserId,
      username: authUser?.username ?? ownUserId,
      status: "ACTIVE",
      created_at: "",
      updated_at: "",
    } as User];
  }, [authUser?.fullName, authUser?.username, isGuard, ownUserId, users.data]);
  const shiftRows = React.useMemo(() => ((shifts.data ?? []) as Shift[]).filter((s) => !placeId.trim() || s.place_id === placeId.trim()), [shifts.data, placeId]);
  const requestedPlaceId = React.useMemo(() => String(searchParams.get("placeId") ?? "").trim(), [searchParams]);
  const requestedUserId = React.useMemo(() => String(searchParams.get("userId") ?? "").trim(), [searchParams]);

  React.useEffect(() => {
    if (placeId.trim()) return;
    if (requestedPlaceId && placeRows.some((p) => p.id === requestedPlaceId)) {
      setPlaceId(requestedPlaceId);
      return;
    }
    if (preferredPlaceId && placeRows.some((p) => p.id === preferredPlaceId)) {
      setPlaceId(preferredPlaceId);
      return;
    }
    if (placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows, preferredPlaceId, requestedPlaceId]);

  React.useEffect(() => {
    if (!isGuard || !ownUserId) return;
    if (filterUserId !== ownUserId) setFilterUserId(ownUserId);
  }, [filterUserId, isGuard, ownUserId]);

  React.useEffect(() => {
    if (isGuard) return;
    if (!requestedUserId || filterUserId.trim()) return;
    setFilterUserId(requestedUserId);
  }, [filterUserId, isGuard, requestedUserId]);

  const reportMonthDatesQuery = useQuery({
    queryKey: ["satpam-patrol-report-dates-report-page", placeId, reportCalendarMonth],
    queryFn: async () => listPatrolScanReportDates({ placeId: placeId.trim(), month: reportCalendarMonth }),
    enabled: Boolean(placeId.trim()),
  });
  const availableReportDateRange = React.useMemo(() => ({
    min: reportMonthDatesQuery.data?.min_date ?? "",
    max: reportMonthDatesQuery.data?.max_date ?? "",
  }), [reportMonthDatesQuery.data?.max_date, reportMonthDatesQuery.data?.min_date]);
  const availableReportDates = React.useMemo(
    () => Array.from(new Set((reportMonthDatesQuery.data?.dates ?? []).map((date) => toDateOnly(date)).filter(Boolean))).sort(),
    [reportMonthDatesQuery.data?.dates],
  );

  React.useEffect(() => {
    if (!availableReportDateRange.min || !availableReportDateRange.max) return;
    setReportFromDate((prev) => (prev.trim() ? prev : availableReportDateRange.min));
    setReportToDate((prev) => (prev.trim() ? prev : availableReportDateRange.max));
  }, [availableReportDateRange.max, availableReportDateRange.min]);

  const roundOptionsQuery = useQuery({
    queryKey: ["satpam-patrol-scan-report-round-options", placeId, reportShiftId, reportFromDate, reportToDate],
    queryFn: async () =>
      listPatrolScanReportRounds({
        placeId: placeId.trim() || undefined,
        shiftId: reportShiftId.trim() || undefined,
        fromDate: reportFromDate.trim() || availableReportDateRange.min || undefined,
        toDate: reportToDate.trim() || availableReportDateRange.max || undefined,
      }),
    enabled: Boolean(placeId.trim()),
  });
  const availableRounds = React.useMemo(() => {
    const roundNos = (roundOptionsQuery.data ?? [])
      .map((item) => item.round_no)
      .filter((value) => Number.isFinite(value) && value > 0);
    return Array.from(new Set(roundNos)).sort((a, b) => a - b);
  }, [roundOptionsQuery.data]);

  React.useEffect(() => {
    if (roundOptionsQuery.isLoading || roundOptionsQuery.isFetching) return;
    if (!filterRoundNo.trim()) return;
    if (availableRounds.includes(Number(filterRoundNo))) return;
    setFilterRoundNo("");
  }, [availableRounds, filterRoundNo, roundOptionsQuery.isFetching, roundOptionsQuery.isLoading]);

  const reportListQuery = useQuery({
    queryKey: ["satpam-patrol-scan-report-list-page", placeId, effectiveFilterUserId, reportShiftId, reportFromDate, reportToDate, tableState.sortKey, tableState.sortDirection],
    queryFn: async () => {
      const baseParams = {
        placeId: placeId.trim() || undefined,
        userId: effectiveFilterUserId || undefined,
        shiftId: reportShiftId.trim() || undefined,
        fromDate: reportFromDate.trim() || undefined,
        toDate: reportToDate.trim() || undefined,
        pageSize: 100,
        sortBy: PATROL_SCAN_REPORT_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      } as const;

      const first = await listPatrolScanReports({
        ...baseParams,
        page: 1,
      });

      const totalPages = Math.max(1, first.pagination?.totalPages ?? 1);
      if (totalPages <= 1) return first;

      const data = [...(first.data ?? [])];
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await listPatrolScanReports({
          ...baseParams,
          page,
        });
        data.push(...(next.data ?? []));
      }

      return {
        ...first,
        data,
        pagination: {
          ...first.pagination,
          page: 1,
          pageSize: data.length || 1,
          totalData: data.length,
          totalPages: 1,
        },
      };
    },
    enabled: Boolean(placeId.trim()),
  });

  const roundNoByRunId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of roundOptionsQuery.data ?? []) {
      map.set(item.patrol_run_id, item.round_no);
    }
    return map;
  }, [roundOptionsQuery.data]);
  const allRows = React.useMemo(
    () => (reportListQuery.data?.data ?? []).map((row) => ({ ...row, photo_url: resolveAssetUrl(row.photo_url) })),
    [reportListQuery.data?.data],
  );
  const rows = React.useMemo(
    () => allRows.filter((row) => !filterRoundNo.trim() || roundNoByRunId.get(row.patrol_run_id) === Number(filterRoundNo)),
    [allRows, filterRoundNo, roundNoByRunId],
  );

  const stopProgressTimer = React.useCallback(() => {
    if (!progressTimerRef.current) return;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }, []);
  React.useEffect(() => () => stopProgressTimer(), [stopProgressTimer]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deletePatrolScan(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-scan-report-list-page"] });
    },
  });

  const onDownloadReport = async () => {
    const trackPdfProgress = reportFormat === "pdf";
    try {
      const resolvedFrom = reportFromDate.trim() || availableReportDateRange.min;
      const resolvedTo = reportToDate.trim() || availableReportDateRange.max || resolvedFrom;
      const missingFields: string[] = [];
      if (!placeId.trim()) missingFields.push("Place");
      if (!resolvedFrom) missingFields.push("From Date");
      if (!resolvedTo) missingFields.push("To Date");
      if (missingFields.length > 0) throw new Error(`Silahkan isi terlebih dahulu: ${missingFields.join(", ")}.`);

      setIsDownloadingReport(true);
      if (trackPdfProgress) {
        transferStartedRef.current = false;
        setDownloadProgressPercent(1);
        setDownloadLoadedBytes(0);
        setDownloadTotalBytes(null);
        setDownloadProgressOpen(true);
        stopProgressTimer();
        progressTimerRef.current = setInterval(() => {
          setDownloadProgressPercent((prev) => {
            if (transferStartedRef.current) return prev;
            if (prev >= 92) return prev;
            return Math.min(92, prev + (prev < 20 ? 7 : prev < 50 ? 4 : 2));
          });
          setDownloadLoadedBytes((prev) => (transferStartedRef.current ? prev : prev + 128 * 1024));
        }, 450);
      }

      await downloadPatrolScanReportCsv(
        {
          placeId: placeId.trim(),
          userId: effectiveFilterUserId || undefined,
          shiftId: reportShiftId.trim() || undefined,
          roundNo: filterRoundNo.trim() ? Number(filterRoundNo) : undefined,
          fromDate: resolvedFrom,
          toDate: resolvedTo,
        },
        reportFormat,
        trackPdfProgress ? {
          onProgress: (progress) => {
            transferStartedRef.current = true;
            setDownloadLoadedBytes(progress.loadedBytes);
            setDownloadTotalBytes(progress.totalBytes);
            setDownloadProgressPercent(progress.percent);
          },
        } : undefined,
      );
      if (trackPdfProgress) setDownloadProgressPercent(100);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal download report.");
      setErrorOpen(true);
    } finally {
      setIsDownloadingReport(false);
      if (trackPdfProgress) {
        stopProgressTimer();
        setTimeout(() => setDownloadProgressOpen(false), 300);
      }
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (!canManageOperational) throw new Error("Delete patrol scan hanya tersedia untuk super admin.");
      await deleteMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessText("Patrol scan berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus patrol scan.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<PatrolScanReportRow>[]>(() => [
    {
      key: "scanned_at",
      header: "Scanned At",
      sortable: true,
      className: "w-[180px]",
      render: (row) => formatDateTime(row.scanned_at),
      sortValue: (row) => (row.scanned_at ? new Date(row.scanned_at) : null),
    },
    {
      key: "spot_name",
      header: "Spot",
      sortable: true,
      className: "min-w-[220px]",
      render: (row) => `${row.spot_name} (${row.spot_code})`,
      sortValue: (row) => `${row.spot_name ?? ""} ${row.spot_code ?? ""}`.trim(),
    },
    { key: "user_name", header: "User", sortable: true, className: "w-[180px]" },
    {
      key: "shift_name",
      header: "Shift",
      sortable: true,
      className: "w-[170px]",
      render: (row) => row.shift_name?.trim() || "-",
      sortValue: (row) => row.shift_name?.trim() || null,
    },
    {
      key: "photo_url",
      header: "Photo",
      className: "w-[180px]",
      render: (r) =>
        r.photo_url ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPreviewPhotoUrl(r.photo_url ?? null)} className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <img src={r.photo_url} alt="Patrol Photo" className="h-12 w-12 object-cover" />
            </button>
            <div className="text-[11px] font-semibold text-slate-500">{formatBytesToKB(estimateDataUrlSizeBytes(r.photo_url))}</div>
          </div>
        ) : "-",
    },
    {
      key: "note",
      header: "Note",
      sortable: true,
      className: "min-w-[220px]",
      render: (row) => row.note?.trim() || "-",
      sortValue: (row) => row.note?.trim() || null,
    },
    ...(canManageOperational
      ? [{
          key: "actions",
          header: "Actions",
          className: "w-[140px]",
          render: (row: PatrolScanReportRow) => (
            <Button variant="secondary" className="h-8 px-3 text-[12px]" onClick={() => setDeleteTarget(row)}>
              Delete
            </Button>
          ),
        } satisfies MasterTableColumn<PatrolScanReportRow>]
      : []),
  ], [canManageOperational]);

  return (
    <>
      <PageHeader
        title="Laporan Scan"
        description="Log detail scan patroli untuk kebutuhan laporan dan download. Format tabel disamakan dengan Patrol Scans."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value as ReportDownloadFormat)}
              className="rounded-lg border border-transparent bg-slate-100 px-3 py-2 text-[13px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="csv">CSV biasa</option>
              <option value="pdf">PDF + Gambar</option>
            </select>
            <Button variant="secondary" onClick={onDownloadReport} disabled={!placeId.trim() || isDownloadingReport}>
              {isDownloadingReport ? "Downloading..." : reportFormat === "pdf" ? "Download PDF" : "Download CSV"}
            </Button>
          </div>
        }
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15">
            {placeRows.map((p) => <option key={p.id} value={p.id}>{p.place_name} ({p.place_code})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">User</span>
          <select value={filterUserId} onChange={(e) => { setFilterUserId(e.target.value); }} disabled={isGuard} className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15">
            {!isGuard ? <option value="">All</option> : null}
            {userRows.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Shift</span>
          <select value={reportShiftId} onChange={(e) => { setReportShiftId(e.target.value); }} disabled={!placeId.trim()} className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15">
            <option value="">All</option>
            {shiftRows.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.start_time} - {shift.end_time})</option>)}
          </select>
        </label>
        <DateHighlightField label="From Date" value={reportFromDate} min={availableReportDateRange.min || undefined} max={reportToDate.trim() || availableReportDateRange.max || undefined} availableDates={availableReportDates} onVisibleMonthChange={setReportCalendarMonth} onChange={(value) => { setReportFromDate(value); }} />
        <DateHighlightField label="To Date" value={reportToDate} min={reportFromDate.trim() || availableReportDateRange.min || undefined} max={availableReportDateRange.max || undefined} availableDates={availableReportDates} onVisibleMonthChange={setReportCalendarMonth} onChange={(value) => { setReportToDate(value); }} />
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Ronde</span>
          <select value={filterRoundNo} onChange={(e) => { setFilterRoundNo(e.target.value); }} disabled={!placeId.trim() || roundOptionsQuery.isLoading} className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15">
            <option value="">All</option>
            {availableRounds.map((roundNo) => <option key={roundNo} value={roundNo}>{formatRoundLabel(roundNo)}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {places.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place sedang dimuat." />
        ) : reportListQuery.isLoading ? (
          <LoadingStateCard title="Loading laporan scan..." subtitle="Data laporan scan patroli sedang dimuat." />
        ) : reportListQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {reportListQuery.error instanceof Error ? reportListQuery.error.message : "Gagal load laporan scan."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            defaultPageSize={10}
            emptyMessage="Belum ada data laporan scan."
            disableClientSearch
            serverSorting={{
              sortKey: tableState.sortKey,
              sortDirection: tableState.sortDirection,
              onSortChange: (sortKey, sortDirection) => {
                if (sortKey !== "scanned_at" && sortKey !== "spot_name" && sortKey !== "user_name" && sortKey !== "shift_name" && sortKey !== "note") return;
                setTableState((prev) => ({ ...prev, page: 1, sortKey, sortDirection }));
              },
            }}
          />
        )}
      </div>

      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Laporan Scan" variant="create" title="Error" message={errorText} />
      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Laporan Scan" variant="delete" title="Success" message={successText} />
      <ConfirmModalMaster
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={submitDelete}
        moduleLabel="Laporan Scan"
        action="delete"
        title="Delete Patrol Scan"
        message={`Yakin hapus scan patrol untuk spot ${deleteTarget ? `${deleteTarget.spot_name} (${deleteTarget.spot_code})` : "-"} pada ${deleteTarget ? formatDateTime(deleteTarget.scanned_at) : "-"}?`}
        confirmLabel={deleteMut.isPending ? "Deleting..." : "Delete"}
      />
      <DownloadProgressModal open={downloadProgressOpen} percent={downloadProgressPercent} title="Downloading PDF Laporan Scan" subtitle="Laporan sedang diunduh. Mohon tunggu..." loadedBytes={downloadLoadedBytes} totalBytes={downloadTotalBytes} />

      {previewPhotoUrl ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="w-full max-w-4xl rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Patrol Photo ({formatBytesToKB(estimateDataUrlSizeBytes(previewPhotoUrl))})</div>
              <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700" onClick={() => setPreviewPhotoUrl(null)}>Close</button>
            </div>
            <div className="max-h-[80vh] overflow-auto rounded-lg bg-slate-950">
              <img src={previewPhotoUrl} alt="Patrol Photo Preview" className="mx-auto h-auto max-h-[78vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
