"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import TextField from "@/component/ui/TextField";
import DownloadProgressModal from "@/component/ui/DownloadProgressModal";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { compressImageFileToDataUrl, estimateDataUrlSizeBytes, formatBytesToKB } from "@/libs/image";
import { readListMeta } from "@/libs/list-meta";
import { resolveAssetUrl } from "@/libs/asset-url";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { MeResponse } from "@/repository/auth";
import { me as getMe } from "@/repository/auth";
import type { Attendance, AttendanceCreate, AttendancePatch, AttendanceStatus } from "@/repository/attendances";
import { attendanceHooks } from "@/repository/attendances";
import { downloadAttendanceReportCsv } from "@/repository/reports";
import type { ReportDownloadFormat } from "@/repository/reports";

const ATTENDANCE_PHOTO_MAX_KB = 200;
const ATTENDANCE_WATERMARK_TEXT = "Property of Azzahra System";

type FormState = {
  placeId: string;
  userId: string;
  attendanceDate: string;
  checkInAt: string;
  checkOutAt: string;
  checkInPhotoUrl: string;
  checkOutPhotoUrl: string;
  status: AttendanceStatus;
  note: string;
};

type AttendanceSortColumn = "attendance_date" | "status" | "check_in_at" | "check_out_at";

const ATTENDANCE_SORT_BY_MAP: Record<AttendanceSortColumn, "attendanceDate" | "status" | "checkInAt" | "checkOutAt"> = {
  attendance_date: "attendanceDate",
  status: "status",
  check_in_at: "checkInAt",
  check_out_at: "checkOutAt",
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

function isoToLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localDateTimeToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
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

function toCreatePayload(s: FormState): AttendanceCreate {
  return {
    placeId: s.placeId,
    userId: s.userId,
    attendanceDate: s.attendanceDate,
    checkInAt: localDateTimeToIso(s.checkInAt),
    checkOutAt: localDateTimeToIso(s.checkOutAt),
    checkInPhotoUrl: s.checkInPhotoUrl.trim() ? s.checkInPhotoUrl.trim() : null,
    checkOutPhotoUrl: s.checkOutPhotoUrl.trim() ? s.checkOutPhotoUrl.trim() : null,
    status: s.status,
    note: s.note.trim() ? s.note.trim() : null,
  };
}

function toPatchPayload(s: FormState): AttendancePatch {
  return {
    checkInAt: localDateTimeToIso(s.checkInAt),
    checkOutAt: localDateTimeToIso(s.checkOutAt),
    checkInPhotoUrl: s.checkInPhotoUrl.trim() ? s.checkInPhotoUrl.trim() : null,
    checkOutPhotoUrl: s.checkOutPhotoUrl.trim() ? s.checkOutPhotoUrl.trim() : null,
    status: s.status,
    note: s.note.trim() ? s.note.trim() : null,
  };
}

export default function AttendancesPage() {
  const authUserFromStorage = React.useMemo(() => readAuthSessionUser(), []);
  const needsMeFetch = !authUserFromStorage;
  const meQuery = useQuery({
    queryKey: ["satpam-auth-me-attendances"],
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
  const [filterDate, setFilterDate] = React.useState("");
  const [reportFromDate, setReportFromDate] = React.useState("");
  const [reportToDate, setReportToDate] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: AttendanceSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "attendance_date",
    sortDirection: "desc",
  });
  const effectiveFilterUserId = (isGuard ? ownUserId : filterUserId).trim();

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

  const list = attendanceHooks.useList({
    placeId: filterPlaceId.trim() ? filterPlaceId : undefined,
    userId: effectiveFilterUserId || undefined,
    attendanceDate: filterDate.trim() ? filterDate : undefined,
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: ATTENDANCE_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });

  const createMut = attendanceHooks.useCreate();
  const updateMut = attendanceHooks.useUpdate();
  const removeMut = attendanceHooks.useRemove();
  const rows = React.useMemo(
    () =>
      ((list.data ?? []) as Attendance[]).map((row) => ({
        ...row,
        photo_url: resolveAssetUrl(row.photo_url),
        check_in_photo_url: resolveAssetUrl(row.check_in_photo_url),
        check_out_photo_url: resolveAssetUrl(row.check_out_photo_url),
      })),
    [list.data],
  );
  const listMeta = React.useMemo(() => readListMeta(list.data), [list.data]);
  const pagination = React.useMemo(
    () => ({
      page: listMeta?.pagination?.page ?? tableState.page,
      pageSize: listMeta?.pagination?.pageSize ?? tableState.pageSize,
      totalData: listMeta?.pagination?.totalData ?? rows.length,
      totalPages: listMeta?.pagination?.totalPages ?? (rows.length > 0 ? 1 : 0),
    }),
    [listMeta?.pagination?.page, listMeta?.pagination?.pageSize, listMeta?.pagination?.totalData, listMeta?.pagination?.totalPages, rows.length, tableState.page, tableState.pageSize],
  );
  const availableReportDateRange = React.useMemo(() => {
    const dates = rows.map((r) => toDateOnly(r.attendance_date)).filter(Boolean).sort();
    return {
      min: dates[0] ?? "",
      max: dates[dates.length - 1] ?? "",
    };
  }, [rows]);

  React.useEffect(() => {
    if (!availableReportDateRange.min || !availableReportDateRange.max) return;
    setReportFromDate((prev) => (prev.trim() ? prev : availableReportDateRange.min));
    setReportToDate((prev) => (prev.trim() ? prev : availableReportDateRange.max));
  }, [availableReportDateRange.max, availableReportDateRange.min]);

  React.useEffect(() => {
    setReportFromDate("");
    setReportToDate("");
  }, [filterPlaceId, effectiveFilterUserId]);

  const placeNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of placeRows) m.set(p.id, `${p.place_name ?? p.place_code}`);
    return m;
  }, [placeRows]);

  const userNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of userRows) m.set(u.id, u.full_name ?? u.username ?? u.id);
    return m;
  }, [userRows]);

  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selected, setSelected] = React.useState<Attendance | null>(null);

  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    userId: "",
    attendanceDate: "",
    checkInAt: "",
    checkOutAt: "",
    checkInPhotoUrl: "",
    checkOutPhotoUrl: "",
    status: "PRESENT",
    note: "",
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [previewPhoto, setPreviewPhoto] = React.useState<{ url: string; title: string } | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = React.useState(false);
  const [downloadProgressOpen, setDownloadProgressOpen] = React.useState(false);
  const [downloadProgressPercent, setDownloadProgressPercent] = React.useState(0);
  const [reportFormat, setReportFormat] = React.useState<ReportDownloadFormat>("csv");
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");
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
    const defPlace = filterPlaceId || placeRows[0]?.id || "";
    const defUser = effectiveFilterUserId || userRows[0]?.id || "";
    const today = filterDate || new Date().toISOString().slice(0, 10);

    setMode("create");
    setSelected(null);
    setForm({
      placeId: defPlace,
      userId: defUser,
      attendanceDate: today,
      checkInAt: "",
      checkOutAt: "",
      checkInPhotoUrl: "",
      checkOutPhotoUrl: "",
      status: "PRESENT",
      note: "",
    });
    setOpenForm(true);
  };

  const onClickEdit = (r: Attendance) => {
    setMode("edit");
    setSelected(r);
    setForm({
      placeId: r.place_id,
      userId: r.user_id,
      attendanceDate: r.attendance_date,
      checkInAt: isoToLocalDateTime(r.check_in_at),
      checkOutAt: isoToLocalDateTime(r.check_out_at),
      checkInPhotoUrl: r.check_in_photo_url ?? r.photo_url ?? "",
      checkOutPhotoUrl: r.check_out_photo_url ?? "",
      status: r.status,
      note: r.note ?? "",
    });
    setOpenForm(true);
  };

  const onClickDelete = (r: Attendance) => {
    setSelected(r);
    setConfirmDeleteOpen(true);
  };

  const onPickPhoto = async (target: "checkIn" | "checkOut", file: File | null) => {
    if (!file) {
      setForm((p) => (target === "checkIn" ? { ...p, checkInPhotoUrl: "" } : { ...p, checkOutPhotoUrl: "" }));
      return;
    }

    try {
      const compressed = await compressImageFileToDataUrl(file, {
        maxKB: ATTENDANCE_PHOTO_MAX_KB,
        watermarkText: ATTENDANCE_WATERMARK_TEXT,
      });
      setForm((p) =>
        target === "checkIn" ? { ...p, checkInPhotoUrl: compressed.dataUrl } : { ...p, checkOutPhotoUrl: compressed.dataUrl },
      );
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal memproses foto.");
      setErrorOpen(true);
    }
  };

  const submit = async () => {
    try {
      if (mode === "create") {
        if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
        const effectiveUserId = (isGuard ? ownUserId : form.userId).trim();
        if (!effectiveUserId) throw new Error("User wajib dipilih.");
        if (!form.attendanceDate.trim()) throw new Error("Tanggal wajib diisi.");

        await createMut.mutateAsync(toCreatePayload({ ...form, userId: effectiveUserId }));
        setSuccessText("Attendance berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;

        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Attendance berhasil diubah.");
      }

      setOpenForm(false);
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const confirmDelete = async () => {
    const id = selected?.id;
    if (!id) return;

    try {
      await removeMut.mutateAsync(id);
      setConfirmDeleteOpen(false);
      setSuccessText("Attendance berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const onDownloadReport = async () => {
    const trackPdfProgress = reportFormat === "pdf";
    try {
      setIsDownloadingReport(true);
      if (trackPdfProgress) {
        transferStartedRef.current = false;
        setDownloadProgressPercent(1);
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

      const resolvedFrom = reportFromDate.trim() || availableReportDateRange.min;
      const resolvedTo = reportToDate.trim() || availableReportDateRange.max || resolvedFrom;
      if (resolvedFrom && resolvedTo && resolvedFrom > resolvedTo) {
        throw new Error("From Date tidak boleh lebih besar dari To Date.");
      }

      await downloadAttendanceReportCsv(
        {
          placeId: filterPlaceId.trim() ? filterPlaceId.trim() : undefined,
          userId: effectiveFilterUserId || undefined,
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
      setSuccessText(reportFormat === "pdf" ? "PDF report attendance berhasil diunduh." : "CSV report attendance berhasil diunduh.");
      setSuccessOpen(true);
    } catch (e) {
      if (trackPdfProgress) {
        stopProgressTimer();
        setDownloadProgressOpen(false);
      }
      setErrorText(e instanceof Error ? e.message : "Gagal download report attendance.");
      setErrorOpen(true);
    } finally {
      stopProgressTimer();
      setIsDownloadingReport(false);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<Attendance>[]>(() => {
    return [
      { key: "attendance_date", header: "Date", sortable: true, className: "w-[140px]" },
      { key: "place_id", header: "Place", render: (r) => placeNameById.get(r.place_id) ?? r.place_id },
      { key: "user_id", header: "User", render: (r) => userNameById.get(r.user_id) ?? r.user_id },
      { key: "status", header: "Status", sortable: true, className: "w-[120px]" },
      {
        key: "late_minutes",
        header: "Late (min)",
        className: "w-[110px]",
        render: (r) => (typeof r.late_minutes === "number" ? String(r.late_minutes) : "-"),
      },
      { key: "check_in_at", header: "Check In", sortable: true, className: "w-[170px]" },
      { key: "check_out_at", header: "Check Out", sortable: true, className: "w-[170px]" },
      {
        key: "check_in_photo_url",
        header: "Check In Photo",
        className: "w-[180px]",
        render: (r) => {
          const url = r.check_in_photo_url ?? r.photo_url ?? null;
          return url ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewPhoto({ url, title: "Check In Photo" })}
                className="overflow-hidden rounded-md border border-slate-200 bg-white"
              >
                <img src={url} alt="Check In Photo" className="h-12 w-12 object-cover" />
              </button>
              <div className="text-[11px] font-semibold text-slate-500">{formatBytesToKB(estimateDataUrlSizeBytes(url))}</div>
            </div>
          ) : (
            "-"
          );
        },
      },
      {
        key: "check_out_photo_url",
        header: "Check Out Photo",
        className: "w-[180px]",
        render: (r) => {
          const url = r.check_out_photo_url ?? null;
          return url ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewPhoto({ url, title: "Check Out Photo" })}
                className="overflow-hidden rounded-md border border-slate-200 bg-white"
              >
                <img src={url} alt="Check Out Photo" className="h-12 w-12 object-cover" />
              </button>
              <div className="text-[11px] font-semibold text-slate-500">{formatBytesToKB(estimateDataUrlSizeBytes(url))}</div>
            </div>
          ) : (
            "-"
          );
        },
      },
      { key: "note", header: "Note" },
      {
        key: "actions",
        header: "Actions",
        className: "w-[220px]",
        render: (r) => (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onClickEdit(r)}>
              Edit
            </Button>
            <Button variant="secondary" onClick={() => onClickDelete(r)}>
              Delete
            </Button>
          </div>
        ),
      },
    ];
  }, [placeNameById, userNameById]);

  const authLoading = needsMeFetch && meQuery.isLoading;
  const authError = meQuery.error;

  return (
    <>
      <PageHeader
        title="Attendances"
        description="Absensi harian."
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
            <Button variant="secondary" onClick={onDownloadReport} disabled={isDownloadingReport}>
              {isDownloadingReport ? "Downloading..." : reportFormat === "pdf" ? "Download PDF" : "Download CSV"}
            </Button>
            <Button onClick={onClickCreate}>+ Create</Button>
          </div>
        }
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] sm:grid-cols-5">
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
          type="date"
          label="Date"
          value={filterDate}
          onChange={(e) => {
            setFilterDate(e.target.value);
            setTableState((prev) => ({ ...prev, page: 1 }));
          }}
        />

        <TextField
          type="date"
          label="From Date (Report)"
          value={reportFromDate}
          min={availableReportDateRange.min || undefined}
          max={reportToDate.trim() || availableReportDateRange.max || undefined}
          onChange={(e) => setReportFromDate(e.target.value)}
        />

        <TextField
          type="date"
          label="To Date (Report)"
          value={reportToDate}
          min={reportFromDate.trim() || availableReportDateRange.min || undefined}
          max={availableReportDateRange.max || undefined}
          onChange={(e) => setReportToDate(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {authLoading ? (
          <LoadingStateCard title="Loading session..." subtitle="Memuat sesi dan akses attendance." />
        ) : authError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {authError instanceof Error ? authError.message : "Gagal load session."}
          </div>
        ) : list.isLoading ? (
          <LoadingStateCard title="Loading attendance..." subtitle="Data attendance sedang dimuat." />
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
            emptyMessage="Belum ada data."
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
                if (sortKey !== "attendance_date" && sortKey !== "status" && sortKey !== "check_in_at" && sortKey !== "check_out_at") return;
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
        moduleLabel="Attendances"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create Attendance" : "Edit Attendance"}
        message={
          <div className="mt-4 grid gap-3">
            {mode === "create" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
                  <select
                    value={form.placeId}
                    onChange={(e) => setForm((p) => ({ ...p, placeId: e.target.value }))}
                    className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
                  >
                    <option value="">Pilih place</option>
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

                <TextField type="date" label="Attendance Date" value={form.attendanceDate} onChange={(e) => setForm((p) => ({ ...p, attendanceDate: e.target.value }))} />
              </>
            ) : (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                <div>
                  <b>{userNameById.get(form.userId) ?? "-"}</b> - {placeNameById.get(form.placeId) ?? "-"} - {form.attendanceDate}
                </div>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as AttendanceStatus }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="OFF">OFF</option>
                <option value="SICK">SICK</option>
                <option value="LEAVE">LEAVE</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Jika check-in diisi dan user punya shift aktif, status otomatis dihitung jadi PRESENT atau LATE.
              </p>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField type="datetime-local" label="Check In" value={form.checkInAt} onChange={(e) => setForm((p) => ({ ...p, checkInAt: e.target.value }))} />
              <TextField type="datetime-local" label="Check Out" value={form.checkOutAt} onChange={(e) => setForm((p) => ({ ...p, checkOutAt: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-slate-800">Check In Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPickPhoto("checkIn", e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
                />
                {form.checkInPhotoUrl ? (
                  <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-2">
                    <img src={form.checkInPhotoUrl} alt="Preview Check In Photo" className="h-32 w-auto rounded-md object-cover" />
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                      {formatBytesToKB(estimateDataUrlSizeBytes(form.checkInPhotoUrl))} (target {ATTENDANCE_PHOTO_MAX_KB} KB)
                    </div>
                    <div className="mt-2">
                      <Button variant="secondary" onClick={() => setForm((p) => ({ ...p, checkInPhotoUrl: "" }))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-slate-800">Check Out Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPickPhoto("checkOut", e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
                />
                {form.checkOutPhotoUrl ? (
                  <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-2">
                    <img src={form.checkOutPhotoUrl} alt="Preview Check Out Photo" className="h-32 w-auto rounded-md object-cover" />
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                      {formatBytesToKB(estimateDataUrlSizeBytes(form.checkOutPhotoUrl))} (target {ATTENDANCE_PHOTO_MAX_KB} KB)
                    </div>
                    <div className="mt-2">
                      <Button variant="secondary" onClick={() => setForm((p) => ({ ...p, checkOutPhotoUrl: "" }))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}
              </label>
            </div>

            <TextField label="Note" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Catatan..." />
          </div>
        }
        confirmLabel={mode === "create" ? "Create" : "Save"}
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        moduleLabel="Attendances"
        action="delete"
        title="Delete Attendance"
        message={
          <div>
            Yakin hapus attendance <b>{selected?.attendance_date ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Attendances" variant={mode === "create" ? "create" : "edit"} title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Attendances" variant={mode === "create" ? "create" : "edit"} title="Error" message={errorText} />
      <DownloadProgressModal
        open={downloadProgressOpen}
        percent={downloadProgressPercent}
        title="Downloading PDF Attendance"
        subtitle="Laporan sedang diunduh. Mohon tunggu..."
      />

      {previewPhoto ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="w-full max-w-4xl rounded-xl bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">
                {previewPhoto.title} ({formatBytesToKB(estimateDataUrlSizeBytes(previewPhoto.url))})
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                onClick={() => setPreviewPhoto(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto rounded-lg bg-slate-950">
              <img src={previewPhoto.url} alt="Attendance Photo Preview" className="mx-auto h-auto max-h-[78vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

