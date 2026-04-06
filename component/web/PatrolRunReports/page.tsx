"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import DateHighlightField from "@/component/ui/DateHighlightField";
import DownloadProgressModal from "@/component/ui/DownloadProgressModal";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ErrorModalMaster } from "@/component/ui/layout/ModalMaster";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { Shift } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { PatrolRun } from "@/repository/patrol-runs/model";
import { listPatrolRuns } from "@/repository/patrol-runs/services";
import {
  downloadPatrolScanReportCsv,
  listPatrolScanReportDates,
} from "@/repository/reports";
import type { ReportDownloadFormat } from "@/repository/reports";

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

function formatRunLabel(runNo: number | null | undefined): string {
  return Number(runNo) === 0 ? "Tanpa Ronde" : `Ronde ${runNo ?? "-"}`;
}

export default function PatrolRunReportsPage() {
  const places = placeHooks.useList({});
  const shifts = shiftHooks.useList({});
  const users = userHooks.useList({});
  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const userRows = React.useMemo(() => (users.data ?? []) as User[], [users.data]);
  const userNameById = React.useMemo(() => new Map(userRows.map((row) => [row.id, row.full_name || row.username || row.id])), [userRows]);
  const [placeId, setPlaceId] = React.useState("");
  const [filterShiftId, setFilterShiftId] = React.useState("");
  const [filterRunNo, setFilterRunNo] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [reportCalendarMonth, setReportCalendarMonth] = React.useState(() => toDateOnly(new Date().toISOString()).slice(0, 7));
  const [reportFormat, setReportFormat] = React.useState<ReportDownloadFormat>("pdf");
  const [isDownloadingReport, setIsDownloadingReport] = React.useState(false);
  const [downloadProgressOpen, setDownloadProgressOpen] = React.useState(false);
  const [downloadProgressPercent, setDownloadProgressPercent] = React.useState(0);
  const [downloadLoadedBytes, setDownloadLoadedBytes] = React.useState(0);
  const [downloadTotalBytes, setDownloadTotalBytes] = React.useState<number | null>(null);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const progressTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const transferStartedRef = React.useRef(false);

  const shiftRows = React.useMemo(
    () => ((shifts.data ?? []) as Shift[]).filter((s) => !placeId.trim() || s.place_id === placeId.trim()),
    [placeId, shifts.data],
  );

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const reportMonthDatesQuery = useQuery({
    queryKey: ["satpam-patrol-run-report-dates-page", placeId, reportCalendarMonth],
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
    setFromDate((prev) => (prev.trim() ? prev : availableReportDateRange.min));
    setToDate((prev) => (prev.trim() ? prev : availableReportDateRange.max));
  }, [availableReportDateRange.max, availableReportDateRange.min]);

  const runOptionsQuery = useQuery({
    queryKey: ["satpam-patrol-run-report-round-options", placeId, filterShiftId, fromDate, toDate],
    queryFn: async () =>
      listPatrolRuns({
        placeId: placeId.trim(),
        shiftId: filterShiftId.trim() || undefined,
        fromDate: fromDate.trim() || availableReportDateRange.min || undefined,
        toDate: toDate.trim() || availableReportDateRange.max || undefined,
        page: 1,
        pageSize: 200,
        sortBy: "runNo",
        sortOrder: "asc",
      }),
    enabled: Boolean(placeId.trim()),
  });
  const availableRounds = React.useMemo(() => {
    const roundNos = (runOptionsQuery.data ?? [])
      .map((run) => run.run_no)
      .filter((value) => Number.isFinite(value) && value > 0);
    return Array.from(new Set(roundNos)).sort((a, b) => a - b);
  }, [runOptionsQuery.data]);

  React.useEffect(() => {
    if (!filterRunNo.trim()) return;
    if (availableRounds.includes(Number(filterRunNo))) return;
    setFilterRunNo("");
  }, [availableRounds, filterRunNo]);

  const listQuery = useQuery({
    queryKey: ["satpam-patrol-run-report-list-page", placeId, filterShiftId, filterRunNo, fromDate, toDate],
    queryFn: async () =>
      listPatrolRuns({
        placeId,
        shiftId: filterShiftId.trim() || undefined,
        runNo: filterRunNo.trim() ? Number(filterRunNo) : undefined,
        fromDate: fromDate.trim() || undefined,
        toDate: toDate.trim() || undefined,
        page: 1,
        pageSize: 100,
        sortBy: "startedAt",
        sortOrder: "desc",
      }),
    enabled: Boolean(placeId.trim()),
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as PatrolRun[], [listQuery.data]);

  const stopProgressTimer = React.useCallback(() => {
    if (!progressTimerRef.current) return;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }, []);

  React.useEffect(() => () => stopProgressTimer(), [stopProgressTimer]);

  const onDownloadReport = async () => {
    const trackPdfProgress = reportFormat === "pdf";
    try {
      const resolvedFrom = fromDate.trim() || availableReportDateRange.min;
      const resolvedTo = toDate.trim() || availableReportDateRange.max || resolvedFrom;
      const missingFields: string[] = [];
      if (!placeId.trim()) missingFields.push("Place");
      if (!filterShiftId.trim()) missingFields.push("Shift");
      if (!filterRunNo.trim()) missingFields.push("Ronde");
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
          shiftId: filterShiftId.trim(),
          roundNo: Number(filterRunNo),
          fromDate: resolvedFrom,
          toDate: resolvedTo,
        },
        reportFormat,
        trackPdfProgress
          ? {
              onProgress: (progress) => {
                transferStartedRef.current = true;
                setDownloadLoadedBytes(progress.loadedBytes);
                setDownloadTotalBytes(progress.totalBytes);
                setDownloadProgressPercent(progress.percent);
              },
            }
          : undefined,
      );
      if (trackPdfProgress) setDownloadProgressPercent(100);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal download laporan patroli.");
      setErrorOpen(true);
    } finally {
      setIsDownloadingReport(false);
      if (trackPdfProgress) {
        stopProgressTimer();
        setTimeout(() => setDownloadProgressOpen(false), 300);
      }
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<PatrolRun>[]>(() => [
    { key: "run_no", header: "Ronde", sortable: true, className: "w-[140px]", render: (row) => formatRunLabel(row.run_no), sortValue: (row) => row.run_no ?? -1 },
    { key: "id", header: "Run ID", sortable: true, className: "min-w-[220px]" },
    {
      key: "shift_name",
      header: "Shift",
      sortable: true,
      className: "min-w-[180px]",
      render: (row) => row.shift_name?.trim() || "-",
      sortValue: (row) => row.shift_name?.trim() || null,
    },
    { key: "status", header: "Status", sortable: true, className: "w-[120px]", render: (row) => row.status.toUpperCase() },
    { key: "progress", header: "Progress", className: "w-[180px]", render: (row) => `${row.unique_scanned_spots}/${row.total_active_spots} spot | ${row.scan_count} scan` },
    {
      key: "user_id",
      header: "User",
      sortable: true,
      className: "min-w-[220px]",
      render: (row) => userNameById.get(row.user_id) ?? row.user_id,
      sortValue: (row) => userNameById.get(row.user_id) ?? row.user_id,
    },
    {
      key: "started_at",
      header: "Started",
      sortable: true,
      className: "w-[200px]",
      render: (row) => formatDateTime(row.started_at),
      sortValue: (row) => (row.started_at ? new Date(row.started_at) : null),
    },
    {
      key: "completed_at",
      header: "Completed",
      sortable: true,
      className: "w-[200px]",
      render: (row) => formatDateTime(row.completed_at),
      sortValue: (row) => (row.completed_at ? new Date(row.completed_at) : null),
    },
  ], [userNameById]);

  return (
    <>
      <PageHeader
        title="Laporan Patroli"
        description="Laporan ronde patroli berbasis patrol run. Tabel utama memakai data ronde dari backend, sedangkan download PDF/CSV tetap memakai detail scan per ronde."
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

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] lg:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15">
            {placeRows.map((row) => <option key={row.id} value={row.id}>{row.place_name} ({row.place_code})</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Shift</span>
          <select value={filterShiftId} onChange={(e) => setFilterShiftId(e.target.value)} className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15">
            <option value="">Semua shift</option>
            {shiftRows.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.start_time} - {row.end_time})</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Ronde</span>
          <select
            value={filterRunNo}
            onChange={(e) => setFilterRunNo(e.target.value)}
            disabled={!placeId.trim() || !fromDate.trim() || !toDate.trim()}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">Semua ronde</option>
            {availableRounds.map((roundNo) => <option key={roundNo} value={String(roundNo)}>{formatRunLabel(roundNo)}</option>)}
          </select>
        </label>

        <DateHighlightField label="From Date" value={fromDate} min={availableReportDateRange.min || undefined} max={toDate.trim() || availableReportDateRange.max || undefined} availableDates={availableReportDates} onVisibleMonthChange={setReportCalendarMonth} onChange={setFromDate} />
        <DateHighlightField label="To Date" value={toDate} min={fromDate.trim() || availableReportDateRange.min || undefined} max={availableReportDateRange.max || undefined} availableDates={availableReportDates} onVisibleMonthChange={setReportCalendarMonth} onChange={setToDate} />
      </div>

      <div className="space-y-3">
        {places.isLoading || shifts.isLoading ? (
          <LoadingStateCard title="Loading data..." subtitle="Memuat place dan shift." />
        ) : listQuery.isLoading ? (
          <LoadingStateCard title="Loading laporan patroli..." subtitle="Data ronde patroli sedang dimuat." />
        ) : listQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {listQuery.error instanceof Error ? listQuery.error.message : "Gagal load laporan patroli."}
          </div>
        ) : (
          <MasterTable columns={columns} data={rows} getRowKey={(row) => row.id} defaultPageSize={20} emptyMessage="Belum ada data laporan patroli." />
        )}
      </div>

      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Laporan Patroli" variant="create" title="Error" message={errorText} />
      <DownloadProgressModal open={downloadProgressOpen} percent={downloadProgressPercent} title="Downloading PDF Laporan Patroli" subtitle="Laporan sedang diunduh. Mohon tunggu..." loadedBytes={downloadLoadedBytes} totalBytes={downloadTotalBytes} />
    </>
  );
}
