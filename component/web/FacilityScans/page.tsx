"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { MeResponse } from "@/repository/auth";
import { me as getMe } from "@/repository/auth";
import type { FacilityCheckSpot } from "@/repository/facility-spots";
import { listFacilitySpots } from "@/repository/facility-spots";
import type { FacilityCheckItem } from "@/repository/facility-items";
import { listFacilityItems } from "@/repository/facility-items";

import type { FacilityCheckScan, FacilityCheckScanCreate, FacilityScanStatus } from "@/repository/facility-scans";
import { createFacilityScan, listFacilityScans } from "@/repository/facility-scans";
import { downloadFacilityScanReportCsv, listFacilityScanReports } from "@/repository/reports";

type FormState = {
  spotId: string;
  itemId: string;
  userId: string;
  status: FacilityScanStatus;
  note: string;
  scannedAt: string;
};

type FacilityScanSortColumn = "scanned_at" | "status" | "spot_id" | "user_id";

const FACILITY_SCAN_SORT_BY_MAP: Record<FacilityScanSortColumn, "scannedAt" | "status" | "spotId" | "userId"> = {
  scanned_at: "scannedAt",
  status: "status",
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

function formatFacilityScanDateTime(value: string | null | undefined): string {
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

function toCreatePayload(placeId: string, s: FormState): FacilityCheckScanCreate {
  return {
    placeId,
    spotId: s.spotId,
    itemId: s.itemId.trim() ? s.itemId.trim() : undefined,
    userId: s.userId,
    status: s.status,
    note: s.note.trim() ? s.note.trim() : null,
    scannedAt: localDateTimeToIso(s.scannedAt),
  };
}

export default function FacilityScansPage() {
  const qc = useQueryClient();
  const authUserFromStorage = React.useMemo(() => readAuthSessionUser(), []);
  const needsMeFetch = !authUserFromStorage;
  const meQuery = useQuery({
    queryKey: ["satpam-auth-me-facility-scans"],
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

  const [placeId, setPlaceId] = React.useState("");
  const [filterSpotId, setFilterSpotId] = React.useState("");
  const [filterUserId, setFilterUserId] = React.useState("");
  const effectiveFilterUserId = (isGuard ? ownUserId : filterUserId).trim();
  const [reportFromDate, setReportFromDate] = React.useState("");
  const [reportToDate, setReportToDate] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: FacilityScanSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "scanned_at",
    sortDirection: "desc",
  });

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

  const spotListQuery = useQuery({
    queryKey: ["satpam-facility-spots", placeId],
    queryFn: async () => listFacilitySpots({ placeId }),
    enabled: Boolean(placeId.trim()),
  });

  const facilitySpots = React.useMemo(() => (spotListQuery.data ?? []) as FacilityCheckSpot[], [spotListQuery.data]);

  const listQuery = useQuery({
    queryKey: ["satpam-facility-scans", placeId, filterSpotId, filterUserId, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listFacilityScans({
        placeId,
        spotId: filterSpotId.trim() ? filterSpotId : undefined,
        userId: effectiveFilterUserId || undefined,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: FACILITY_SCAN_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: Boolean(placeId.trim()),
  });

  const createMut = useMutation({
    mutationFn: async (body: FacilityCheckScanCreate) => createFacilityScan(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-facility-scans", placeId, filterSpotId, filterUserId] });
    },
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as FacilityCheckScan[], [listQuery.data]);
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
  const reportRangeMinQuery = useQuery({
    queryKey: ["satpam-facility-report-range", "min", placeId, filterSpotId, effectiveFilterUserId],
    queryFn: async () =>
      listFacilityScanReports({
        placeId: placeId.trim(),
        spotId: filterSpotId.trim() ? filterSpotId.trim() : undefined,
        userId: effectiveFilterUserId || undefined,
        page: 1,
        pageSize: 1,
        sortBy: "scannedAt",
        sortOrder: "asc",
      }),
    enabled: Boolean(placeId.trim()),
  });
  const reportRangeMaxQuery = useQuery({
    queryKey: ["satpam-facility-report-range", "max", placeId, filterSpotId, effectiveFilterUserId],
    queryFn: async () =>
      listFacilityScanReports({
        placeId: placeId.trim(),
        spotId: filterSpotId.trim() ? filterSpotId.trim() : undefined,
        userId: effectiveFilterUserId || undefined,
        page: 1,
        pageSize: 1,
        sortBy: "scannedAt",
        sortOrder: "desc",
      }),
    enabled: Boolean(placeId.trim()),
  });
  const availableReportDateRange = React.useMemo(() => {
    const minFromReportApi = toDateOnly(reportRangeMinQuery.data?.data?.[0]?.scanned_at);
    const maxFromReportApi = toDateOnly(reportRangeMaxQuery.data?.data?.[0]?.scanned_at);
    if (minFromReportApi && maxFromReportApi) {
      return { min: minFromReportApi, max: maxFromReportApi };
    }

    const dates = rows.map((r) => toDateOnly(r.scanned_at)).filter(Boolean).sort();
    return {
      min: dates[0] ?? "",
      max: dates[dates.length - 1] ?? "",
    };
  }, [reportRangeMaxQuery.data?.data, reportRangeMinQuery.data?.data, rows]);

  React.useEffect(() => {
    if (!availableReportDateRange.min || !availableReportDateRange.max) return;
    setReportFromDate((prev) => (prev.trim() ? prev : availableReportDateRange.min));
    setReportToDate((prev) => (prev.trim() ? prev : availableReportDateRange.max));
  }, [availableReportDateRange.max, availableReportDateRange.min]);

  React.useEffect(() => {
    setReportFromDate("");
    setReportToDate("");
  }, [placeId, filterSpotId, effectiveFilterUserId]);

  const spotLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of facilitySpots) m.set(s.id, `${s.spot_name} (${s.spot_code})`);
    return m;
  }, [facilitySpots]);

  const userLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of userRows) m.set(u.id, u.full_name ?? u.username ?? u.id);
    return m;
  }, [userRows]);

  const [openForm, setOpenForm] = React.useState(false);

  const [form, setForm] = React.useState<FormState>({
    spotId: "",
    itemId: "",
    userId: "",
    status: "OK",
    note: "",
    scannedAt: "",
  });

  const formItemListQuery = useQuery({
    queryKey: ["satpam-facility-items-form", form.spotId],
    queryFn: async () => listFacilityItems({ spotId: form.spotId }),
    enabled: Boolean(form.spotId.trim()),
  });
  const formItems = React.useMemo(() => (formItemListQuery.data ?? []) as FacilityCheckItem[], [formItemListQuery.data]);

  React.useEffect(() => {
    if (!openForm) return;
    if (!form.spotId.trim()) return;
    if (form.itemId.trim()) return;
    const firstActiveItem = formItems.find((row) => row.is_active)?.id ?? formItems[0]?.id ?? "";
    if (firstActiveItem) {
      setForm((prev) => ({ ...prev, itemId: firstActiveItem }));
    }
  }, [form.itemId, form.spotId, formItems, openForm]);

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [isDownloadingReport, setIsDownloadingReport] = React.useState(false);

  const onClickCreate = () => {
    const defSpot = filterSpotId || facilitySpots[0]?.id || "";
    const defUser = (isGuard ? ownUserId : filterUserId) || userRows[0]?.id || "";
    setForm({ spotId: defSpot, itemId: "", userId: defUser, status: "OK", note: "", scannedAt: "" });
    setOpenForm(true);
  };

  const submit = async () => {
    try {
      if (!placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.spotId.trim()) throw new Error("Spot wajib dipilih.");
      if (!form.itemId.trim()) throw new Error("Item wajib dipilih.");
      const effectiveUserId = (isGuard ? ownUserId : form.userId).trim();
      if (!effectiveUserId) throw new Error("User wajib dipilih.");

      await createMut.mutateAsync(toCreatePayload(placeId, { ...form, userId: effectiveUserId }));
      setOpenForm(false);
      setSuccessText("Facility scan berhasil dibuat.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const onDownloadReport = async () => {
    try {
      if (!placeId.trim()) throw new Error("Place wajib dipilih.");
      setIsDownloadingReport(true);
      const resolvedFrom = reportFromDate.trim() || availableReportDateRange.min;
      const resolvedTo = reportToDate.trim() || availableReportDateRange.max || resolvedFrom;
      if (resolvedFrom && resolvedTo && resolvedFrom > resolvedTo) {
        throw new Error("From Date tidak boleh lebih besar dari To Date.");
      }

      await downloadFacilityScanReportCsv({
        placeId: placeId.trim(),
        spotId: filterSpotId.trim() ? filterSpotId.trim() : undefined,
        userId: effectiveFilterUserId || undefined,
        fromDate: resolvedFrom || undefined,
        toDate: resolvedTo || undefined,
      });
      setSuccessText("File report facility scan berhasil diunduh.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal download report facility scan.");
      setErrorOpen(true);
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<FacilityCheckScan>[]>(() => {
    return [
      {
        key: "scanned_at",
        header: "Scanned At",
        sortable: true,
        className: "w-[200px]",
        render: (r) => formatFacilityScanDateTime(r.scanned_at),
      },
      { key: "spot_id", header: "Spot", sortable: true, render: (r) => spotLabelById.get(r.spot_id) ?? r.spot_id },
      { key: "item_name", header: "Item", render: (r) => r.item_name ?? "-" },
      { key: "user_id", header: "User", sortable: true, render: (r) => userLabelById.get(r.user_id) ?? r.user_id },
      { key: "status", header: "Status", sortable: true, className: "w-[120px]" },
      { key: "note", header: "Note" },
    ];
  }, [spotLabelById, userLabelById]);

  const anyLoading = places.isLoading || (canLoadUsers && users.isLoading) || spotListQuery.isLoading || (needsMeFetch && meQuery.isLoading);
  const anyError = places.error ?? users.error ?? spotListQuery.error ?? meQuery.error;

  return (
    <>
      <PageHeader
        title="Facility Scans"
        description="Hasil scan checklist facility per place."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onDownloadReport} disabled={!placeId.trim() || isDownloadingReport}>
              {isDownloadingReport ? "Downloading..." : "Download CSV"}
            </Button>
            <Button onClick={onClickCreate} disabled={!placeId.trim()}>
              + Create
            </Button>
          </div>
        }
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] sm:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setFilterSpotId("");
              setFilterUserId(isGuard ? ownUserId : "");
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
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Spot</span>
          <select
            value={filterSpotId}
            onChange={(e) => {
              setFilterSpotId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">All</option>
            {facilitySpots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.spot_name} ({s.spot_code})
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
          label="From Date"
          value={reportFromDate}
          min={availableReportDateRange.min || undefined}
          max={reportToDate.trim() || availableReportDateRange.max || undefined}
          onChange={(e) => setReportFromDate(e.target.value)}
        />

        <TextField
          type="date"
          label="To Date"
          value={reportToDate}
          min={reportFromDate.trim() || availableReportDateRange.min || undefined}
          max={availableReportDateRange.max || undefined}
          onChange={(e) => setReportToDate(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {anyLoading ? (
          <LoadingStateCard title="Loading master data..." subtitle="Place, user, dan checklist facility sedang dimuat." />
        ) : anyError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {anyError instanceof Error ? anyError.message : "Gagal load master data."}
          </div>
        ) : !placeId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih place.</div>
        ) : listQuery.isLoading ? (
          <LoadingStateCard title="Loading facility scans..." subtitle="Data hasil scan facility sedang dimuat." />
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
                if (sortKey !== "scanned_at" && sortKey !== "status" && sortKey !== "spot_id" && sortKey !== "user_id") return;
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
        moduleLabel="Facility Scans"
        action="create"
        title="Create Facility Scan"
        message={
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Spot</span>
              <select
                value={form.spotId}
                onChange={(e) => setForm((p) => ({ ...p, spotId: e.target.value, itemId: "" }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih spot</option>
                {facilitySpots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.spot_name} ({s.spot_code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Item</span>
              <select
                value={form.itemId}
                onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih item</option>
                {formItems.filter((it) => it.is_active).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.item_name}
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

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as FacilityScanStatus }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="OK">OK</option>
                <option value="NOT_OK">NOT_OK</option>
                <option value="PARTIAL">PARTIAL</option>
              </select>
            </label>

            <TextField type="datetime-local" label="Scanned At (optional)" value={form.scannedAt} onChange={(e) => setForm((p) => ({ ...p, scannedAt: e.target.value }))} />
            <TextField label="Note" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Catatan..." />
          </div>
        }
        confirmLabel="Create"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Facility Scans" variant="create" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Facility Scans" variant="create" title="Error" message={errorText} />
    </>
  );
}
