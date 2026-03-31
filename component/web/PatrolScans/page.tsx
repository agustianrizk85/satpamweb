"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import TextField from "@/component/ui/TextField";
import DateHighlightField from "@/component/ui/DateHighlightField";
import DownloadProgressModal from "@/component/ui/DownloadProgressModal";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { estimateDataUrlSizeBytes, formatBytesToKB } from "@/libs/image";
import { readListMeta } from "@/libs/list-meta";
import { resolveAssetUrl } from "@/libs/asset-url";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { MeResponse } from "@/repository/auth";
import { me as getMe } from "@/repository/auth";
import type { Spot } from "@/repository/Spots";
import { spotHooks } from "@/repository/Spots";
import type { Shift } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";

import type { PatrolScan, PatrolScanCreate } from "@/repository/patrol-scans";
import { createPatrolScan, listPatrolScans } from "@/repository/patrol-scans";
import { downloadPatrolScanReportCsv, listPatrolScanReportDates, listPatrolScanReportRounds } from "@/repository/reports";
import type { ReportDownloadFormat } from "@/repository/reports";

type FormState = {
  spotId: string;
  userId: string;
  patrolRunId: string;
  photoUrl: string;
  note: string;
};

type PatrolScanSortColumn = "scanned_at" | "patrol_run_id" | "spot_id" | "user_id";

const PATROL_SCAN_SORT_BY_MAP: Record<PatrolScanSortColumn, "scannedAt" | "patrolRunId" | "spotId" | "userId"> = {
  scanned_at: "scannedAt",
  patrol_run_id: "patrolRunId",
  spot_id: "spotId",
  user_id: "userId",
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

function toCreatePayload(placeId: string, s: FormState): PatrolScanCreate {
  return {
    placeId,
    userId: s.userId,
    spotId: s.spotId,
    patrolRunId: s.patrolRunId.trim(),
    photoUrl: s.photoUrl.trim() ? s.photoUrl.trim() : null,
    note: s.note.trim() ? s.note.trim() : null,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca file foto."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file foto."));
    reader.readAsDataURL(file);
  });
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

function formatPatrolScanDateTime(value: string | null | undefined): string {
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

export default function PatrolScansPage() {
  const qc = useQueryClient();
  const authUserFromStorage = React.useMemo(() => readAuthSessionUser(), []);
  const needsMeFetch = !authUserFromStorage;
  const meQuery = useQuery({
    queryKey: ["satpam-auth-me-patrol-scans"],
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
  const [placeId, setPlaceId] = React.useState("");
  const [filterUserId, setFilterUserId] = React.useState("");
  const [filterRunId, setFilterRunId] = React.useState("");
  const [reportShiftId, setReportShiftId] = React.useState("");
  const [reportRoundNo, setReportRoundNo] = React.useState("");
  const [reportFromDate, setReportFromDate] = React.useState("");
  const [reportToDate, setReportToDate] = React.useState("");
  const [reportCalendarMonth, setReportCalendarMonth] = React.useState(() => toDateOnly(new Date().toISOString()).slice(0, 7));
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: PatrolScanSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "scanned_at",
    sortDirection: "desc",
  });
  const effectiveFilterUserId = (isGuard ? ownUserId : filterUserId).trim();

  const places = placeHooks.useList({});
  const users = userHooks.useList({}, { enabled: canLoadUsers });
  const spots = spotHooks.useList({ placeId: placeId.trim() ? placeId.trim() : undefined }, { enabled: Boolean(placeId.trim()) });
  const shifts = shiftHooks.useList({});

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const userRows = React.useMemo(() => {
    if (!isGuard) return (users.data ?? []) as User[];
    if (!ownUserId) return [] as User[];
    return [
      {
        id: ownUserId,
        role: { id: "", code: "GUARD", name: "Petugas" },
        full_name: authUser?.fullName ?? authUser?.username ?? ownUserId,
        username: authUser?.username ?? ownUserId,
        status: "ACTIVE",
        created_at: "",
        updated_at: "",
      } as User,
    ];
  }, [authUser?.fullName, authUser?.username, isGuard, ownUserId, users.data]);
  const spotRows = React.useMemo(() => (spots.data ?? []) as Spot[], [spots.data]);
  const shiftRows = React.useMemo(() => ((shifts.data ?? []) as Shift[]).filter((s) => !placeId.trim() || s.place_id === placeId.trim()), [placeId, shifts.data]);

  React.useEffect(() => {
    if (placeId.trim()) return;
    if (preferredPlaceId && placeRows.some((p) => p.id === preferredPlaceId)) {
      setPlaceId(preferredPlaceId);
      return;
    }
    if (placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows, preferredPlaceId]);

  React.useEffect(() => {
    if (!isGuard || !ownUserId) return;
    if (filterUserId !== ownUserId) setFilterUserId(ownUserId);
  }, [filterUserId, isGuard, ownUserId]);

  const filteredSpots = React.useMemo(() => {
    const pid = placeId.trim();
    if (!pid) return [];
    return spotRows.filter((s) => s.place_id === pid);
  }, [placeId, spotRows]);

  const listQuery = useQuery({
    queryKey: ["satpam-patrol-scans", placeId, effectiveFilterUserId, filterRunId, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listPatrolScans({
        placeId,
        userId: effectiveFilterUserId || undefined,
        patrolRunId: filterRunId.trim() ? filterRunId.trim() : undefined,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: PATROL_SCAN_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: Boolean(placeId.trim()),
  });

  const createMut = useMutation({
    mutationFn: async (body: PatrolScanCreate) => createPatrolScan(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-scans", placeId, effectiveFilterUserId, filterRunId] });
    },
  });

  const rows = React.useMemo(
    () =>
      ((listQuery.data ?? []) as PatrolScan[]).map((row) => ({
        ...row,
        photo_url: resolveAssetUrl(row.photo_url),
      })),
    [listQuery.data],
  );
  const listMeta = React.useMemo(() => readListMeta(listQuery.data), [listQuery.data]);
  const pagination = React.useMemo(
    () => ({
      page: listMeta?.pagination?.page ?? tableState.page,
      pageSize: listMeta?.pagination?.pageSize ?? tableState.pageSize,
      totalData: listMeta?.pagination?.totalData ?? rows.length,
      totalPages: listMeta?.pagination?.totalPages ?? (rows.length > 0 ? 1 : 0),
    }),
    [listMeta?.pagination?.page, listMeta?.pagination?.pageSize, listMeta?.pagination?.totalData, listMeta?.pagination?.totalPages, rows.length, tableState.page, tableState.pageSize],
  );
  const knownRunIds = React.useMemo(() => {
    const ids = rows.map((r) => r.patrol_run_id).filter((v): v is string => Boolean(v && v.trim()));
    return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const reportMonthDatesQuery = useQuery({
    queryKey: ["satpam-patrol-report-dates", placeId, reportCalendarMonth],
    queryFn: async () => listPatrolScanReportDates({ placeId: placeId.trim(), month: reportCalendarMonth }),
    enabled: Boolean(placeId.trim()),
  });
  const availableReportDateRange = React.useMemo(() => ({
    min: reportMonthDatesQuery.data?.min_date ?? "",
    max: reportMonthDatesQuery.data?.max_date ?? "",
  }), [reportMonthDatesQuery.data?.max_date, reportMonthDatesQuery.data?.min_date]);
  const reportRunOptionsQuery = useQuery({
    queryKey: ["satpam-patrol-report-run-options", placeId, effectiveFilterUserId, reportShiftId, reportFromDate, reportToDate, availableReportDateRange.min, availableReportDateRange.max],
    queryFn: async () =>
      listPatrolScanReportRounds({
        placeId: placeId.trim(),
        userId: effectiveFilterUserId || undefined,
        shiftId: reportShiftId.trim() || undefined,
        fromDate: reportFromDate.trim() || availableReportDateRange.min || undefined,
        toDate: reportToDate.trim() || availableReportDateRange.max || undefined,
      }),
    enabled: Boolean(placeId.trim() && reportShiftId.trim()),
  });
  const availableReportDates = React.useMemo(() => {
    return Array.from(new Set((reportMonthDatesQuery.data?.dates ?? []).map((date) => toDateOnly(date)).filter(Boolean))).sort();
  }, [reportMonthDatesQuery.data?.dates]);
  const availableReportRounds = React.useMemo(() => {
    const runs = reportRunOptionsQuery.data ?? [];
    const roundNos = runs
      .map((run) => run.round_no)
      .filter((value) => Number.isFinite(value) && value > 0);
    return Array.from(new Set(roundNos)).sort((a, b) => a - b);
  }, [reportRunOptionsQuery.data]);

  React.useEffect(() => {
    if (!availableReportDateRange.min || !availableReportDateRange.max) return;
    setReportFromDate((prev) => (prev.trim() ? prev : availableReportDateRange.min));
    setReportToDate((prev) => (prev.trim() ? prev : availableReportDateRange.max));
  }, [availableReportDateRange.max, availableReportDateRange.min]);

  React.useEffect(() => {
    if (!reportRoundNo.trim()) return;
    if (availableReportRounds.includes(Number(reportRoundNo))) return;
    setReportRoundNo("");
  }, [availableReportRounds, reportRoundNo]);

  React.useEffect(() => {
    setReportFromDate("");
    setReportToDate("");
    setReportShiftId("");
    setReportRoundNo("");
  }, [placeId]);

  const userLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of userRows) m.set(u.id, u.full_name ?? u.username ?? u.id);
    return m;
  }, [userRows]);

  const spotLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spotRows) m.set(s.id, `${s.name ?? s.spot_name ?? s.id} (${s.code ?? s.spot_code ?? "-"})`);
    return m;
  }, [spotRows]);

  const [openForm, setOpenForm] = React.useState(false);
  const [form, setForm] = React.useState<FormState>({ spotId: "", userId: "", patrolRunId: "", photoUrl: "", note: "" });

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [previewPhotoUrl, setPreviewPhotoUrl] = React.useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = React.useState(false);
  const [downloadProgressOpen, setDownloadProgressOpen] = React.useState(false);
  const [downloadProgressPercent, setDownloadProgressPercent] = React.useState(0);
  const [downloadLoadedBytes, setDownloadLoadedBytes] = React.useState(0);
  const [downloadTotalBytes, setDownloadTotalBytes] = React.useState<number | null>(null);
  const [reportFormat, setReportFormat] = React.useState<ReportDownloadFormat>("csv");
  const progressTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const transferStartedRef = React.useRef(false);

  const stopProgressTimer = React.useCallback(() => {
    if (!progressTimerRef.current) return;
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }, []);

  React.useEffect(() => {
    return () => stopProgressTimer();
  }, [stopProgressTimer]);

  const onClickCreate = () => {
    const defSpot = filteredSpots[0]?.id ?? "";
    const defUser = effectiveFilterUserId || userRows[0]?.id || "";
    setForm({ spotId: defSpot, userId: defUser, patrolRunId: filterRunId || "", photoUrl: "", note: "" });
    setOpenForm(true);
  };

  const onPickPhoto = async (file: File | null) => {
    if (!file) {
      setForm((p) => ({ ...p, photoUrl: "" }));
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((p) => ({ ...p, photoUrl: dataUrl }));
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal memproses foto.");
      setErrorOpen(true);
    }
  };

  const submit = async () => {
    try {
      if (!placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.spotId.trim()) throw new Error("Spot wajib dipilih.");
      const effectiveUserId = (isGuard ? ownUserId : form.userId).trim();
      if (!effectiveUserId) throw new Error("User wajib dipilih.");
      if (!form.patrolRunId.trim()) throw new Error("Patrol run id wajib diisi.");

      await createMut.mutateAsync(toCreatePayload(placeId, { ...form, userId: effectiveUserId }));
      setOpenForm(false);
      setSuccessText("Patrol scan berhasil dibuat.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const onDownloadReport = async () => {
    const trackPdfProgress = reportFormat === "pdf";
    try {
      const resolvedFrom = reportFromDate.trim() || availableReportDateRange.min;
      const resolvedTo = reportToDate.trim() || availableReportDateRange.max || resolvedFrom;
      const missingFields: string[] = [];
      if (!placeId.trim()) missingFields.push("Place");
      if (!reportShiftId.trim()) missingFields.push("Shift");
      if (!resolvedFrom) missingFields.push("From Date");
      if (!resolvedTo) missingFields.push("To Date");
      if (missingFields.length > 0) {
        throw new Error(`Silahkan isi terlebih dahulu: ${missingFields.join(", ")}.`);
      }
      setIsDownloadingReport(true);
      if (trackPdfProgress) {
        transferStartedRef.current = false;
        setDownloadProgressPercent(1);
        setDownloadLoadedBytes(0);
        setDownloadTotalBytes(null);
        setDownloadProgressOpen(true);
        stopProgressTimer();
        progressTimerRef.current = setInterval(() => {
          if (transferStartedRef.current) return;
          setDownloadProgressPercent((prev) => {
            if (prev >= 84) return prev;
            if (prev < 24) return prev + 4;
            if (prev < 56) return prev + 2;
            return prev + 1;
          });
        }, 240);
      }

      const resolvedRoundNo = reportRoundNo.trim();
      if (resolvedFrom && resolvedTo && resolvedFrom > resolvedTo) {
        throw new Error("From Date tidak boleh lebih besar dari To Date.");
      }
      if (resolvedRoundNo && (!/^\d+$/.test(resolvedRoundNo) || Number(resolvedRoundNo) <= 0)) {
        throw new Error("Ronde harus berupa angka lebih dari 0.");
      }

      await downloadPatrolScanReportCsv(
        {
          placeId: placeId.trim(),
          userId: effectiveFilterUserId || undefined,
          shiftId: reportShiftId.trim() || undefined,
          patrolRunId: filterRunId.trim() ? filterRunId.trim() : undefined,
          roundNo: resolvedRoundNo ? Number(resolvedRoundNo) : undefined,
          fromDate: resolvedFrom || undefined,
          toDate: resolvedTo || undefined,
        },
        reportFormat,
        trackPdfProgress
          ? {
              onProgress: (progress) => {
                if (progress.loadedBytes > 0) {
                  transferStartedRef.current = true;
                  stopProgressTimer();
                }
                setDownloadProgressPercent((prev) => Math.max(prev, progress.percent));
                setDownloadLoadedBytes(progress.loadedBytes);
                setDownloadTotalBytes(progress.totalBytes);
              },
            }
          : undefined,
      );
      if (trackPdfProgress) {
        stopProgressTimer();
        setDownloadProgressPercent(100);
        await new Promise((resolve) => setTimeout(resolve, 240));
        setDownloadProgressOpen(false);
      }
      setSuccessText(reportFormat === "pdf" ? "PDF report patrol scan berhasil diunduh." : "CSV report patrol scan berhasil diunduh.");
      setSuccessOpen(true);
    } catch (e) {
      if (trackPdfProgress) {
        stopProgressTimer();
        setDownloadProgressOpen(false);
      }
      setErrorText(e instanceof Error ? e.message : "Gagal download report patrol scan.");
      setErrorOpen(true);
    } finally {
      stopProgressTimer();
      setIsDownloadingReport(false);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<PatrolScan>[]>(() => {
    return [
      {
        key: "scanned_at",
        header: "Scanned At",
        sortable: true,
        className: "w-[200px]",
        render: (r) => formatPatrolScanDateTime(r.scanned_at),
      },
      { key: "patrol_run_id", header: "Run ID", sortable: true, className: "w-[220px]" },
      { key: "spot_id", header: "Spot", sortable: true, render: (r) => spotLabelById.get(r.spot_id) ?? r.spot_id },
      { key: "user_id", header: "User", sortable: true, render: (r) => userLabelById.get(r.user_id) ?? r.user_id },
      {
        key: "photo_url",
        header: "Photo",
        className: "w-[180px]",
        render: (r) =>
          r.photo_url ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(r.photo_url ?? null)}
                className="overflow-hidden rounded-md border border-slate-200 bg-white"
              >
                <img src={r.photo_url} alt="Patrol Photo" className="h-12 w-12 object-cover" />
              </button>
              <div className="text-[11px] font-semibold text-slate-500">{formatBytesToKB(estimateDataUrlSizeBytes(r.photo_url))}</div>
            </div>
          ) : (
            "-"
          ),
      },
      { key: "note", header: "Note" },
    ];
  }, [spotLabelById, userLabelById]);

  const authLoading = needsMeFetch && meQuery.isLoading;
  const authError = meQuery.error;

  return (
    <>
      <PageHeader
        title="Patrol Scans"
        description="Log scan patroli per place."
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
            <Button onClick={onClickCreate} disabled={!placeId.trim()}>
              + Create
            </Button>
          </div>
        }
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] sm:grid-cols-7">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setFilterUserId(isGuard ? ownUserId : "");
              setFilterRunId("");
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
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
          list="patrol-run-id-options"
          label="Patrol Run ID (filter)"
          value={filterRunId}
          onChange={(e) => {
            setFilterRunId(e.target.value);
            setTableState((prev) => ({ ...prev, page: 1 }));
          }}
          placeholder="RUN-2026-03-03-001"
        />

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Shift</span>
          <select
            value={reportShiftId}
            onChange={(e) => setReportShiftId(e.target.value)}
            disabled={!placeId.trim()}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">All</option>
            {shiftRows.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} ({shift.start_time} - {shift.end_time})
              </option>
            ))}
          </select>
        </label>

        <DateHighlightField
          label="From Date"
          value={reportFromDate}
          min={availableReportDateRange.min || undefined}
          max={reportToDate.trim() || availableReportDateRange.max || undefined}
          availableDates={availableReportDates}
          onVisibleMonthChange={setReportCalendarMonth}
          onChange={setReportFromDate}
        />

        <DateHighlightField
          label="To Date"
          value={reportToDate}
          min={reportFromDate.trim() || availableReportDateRange.min || undefined}
          max={availableReportDateRange.max || undefined}
          availableDates={availableReportDates}
          onVisibleMonthChange={setReportCalendarMonth}
          onChange={setReportToDate}
        />

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Ronde</span>
          <select
            value={reportRoundNo}
            onChange={(e) => setReportRoundNo(e.target.value)}
            disabled={!placeId.trim() || !reportShiftId.trim() || !reportFromDate.trim() || !reportToDate.trim()}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">All</option>
            {availableReportRounds.map((roundNo) => (
              <option key={roundNo} value={String(roundNo)}>
                Ronde {roundNo}
              </option>
            ))}
          </select>
        </label>
      </div>
      <datalist id="patrol-run-id-options">
        {knownRunIds.map((runId) => (
          <option key={runId} value={runId} />
        ))}
      </datalist>

      <div className="space-y-3">
        {authLoading ? (
          <LoadingStateCard title="Loading session..." subtitle="Memuat sesi dan akses patrol scan." />
        ) : authError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {authError instanceof Error ? authError.message : "Gagal load session."}
          </div>
        ) : places.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place sedang dimuat." />
        ) : places.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {places.error instanceof Error ? places.error.message : "Gagal load places."}
          </div>
        ) : !placeId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih place.</div>
        ) : listQuery.isLoading ? (
          <LoadingStateCard title="Loading patrol scans..." subtitle="Data patrol scan sedang dimuat." />
        ) : listQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {listQuery.error instanceof Error ? listQuery.error.message : "Gagal load data."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(r) => r.id}
            defaultPageSize={10}
            emptyMessage="Belum ada scan."
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
                if (sortKey !== "scanned_at" && sortKey !== "patrol_run_id" && sortKey !== "spot_id" && sortKey !== "user_id") return;
                setTableState((prev) => ({ ...prev, page: 1, sortKey, sortDirection }));
              },
            }}
          />
        )}
      </div>

      <ConfirmModalMaster
        open={openForm}
        onClose={() => setOpenForm(false)}
        onConfirm={submit}
        moduleLabel="Patrol Scans"
        action="create"
        title="Create Patrol Scan"
        message={
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Spot</span>
              <select
                value={form.spotId}
                onChange={(e) => setForm((p) => ({ ...p, spotId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih spot</option>
                {filteredSpots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.spot_name ?? s.id} ({s.code ?? s.spot_code ?? "-"})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">User</span>
              <select
                value={form.userId}
                onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                disabled={isGuard}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                {!isGuard ? <option value="">Pilih user</option> : null}
                {userRows.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            </label>

            <TextField
              list="patrol-run-id-options"
              label="Patrol Run ID"
              value={form.patrolRunId}
              onChange={(e) => setForm((p) => ({ ...p, patrolRunId: e.target.value }))}
              placeholder="RUN-2026-03-03-001"
            />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Photo (optional)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              />
            </label>
            {form.photoUrl ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-2">
                <img src={form.photoUrl} alt="Preview Patrol Photo" className="h-40 w-auto rounded-md object-cover" />
                <div className="mt-2">
                  <Button variant="secondary" onClick={() => setForm((p) => ({ ...p, photoUrl: "" }))}>
                    Remove Photo
                  </Button>
                </div>
              </div>
            ) : null}
            <TextField label="Note" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Catatan..." />
          </div>
        }
        confirmLabel="Create"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Patrol Scans" variant="create" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Patrol Scans" variant="create" title="Error" message={errorText} />
      <DownloadProgressModal
        open={downloadProgressOpen}
        percent={downloadProgressPercent}
        title="Downloading PDF Patrol"
        subtitle="Laporan sedang diunduh. Mohon tunggu..."
        loadedBytes={downloadLoadedBytes}
        totalBytes={downloadTotalBytes}
      />

      {previewPhotoUrl ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="w-full max-w-4xl rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">
                Patrol Photo ({formatBytesToKB(estimateDataUrlSizeBytes(previewPhotoUrl))})
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                onClick={() => setPreviewPhotoUrl(null)}
              >
                Close
              </button>
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
