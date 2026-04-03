"use client";

import * as React from "react";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import TextField from "@/component/ui/TextField";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { PatrolRun, PatrolRunCreate, PatrolRunPatch, PatrolRunStatus } from "@/repository/patrol-runs/model";
import { createPatrolRun, deletePatrolRun, listPatrolRuns, updatePatrolRun } from "@/repository/patrol-runs/services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type PatrolRunSortColumn =
  | "run_no"
  | "status"
  | "started_at"
  | "completed_at"
  | "created_at"
  | "total_active_spots";

const PATROL_RUN_SORT_BY_MAP: Record<
  PatrolRunSortColumn,
  "runNo" | "status" | "startedAt" | "completedAt" | "createdAt" | "totalActiveSpots"
> = {
  run_no: "runNo",
  status: "status",
  started_at: "startedAt",
  completed_at: "completedAt",
  created_at: "createdAt",
  total_active_spots: "totalActiveSpots",
};

type FormState = {
  placeId: string;
  userId: string;
  attendanceId: string;
  runNo: string;
  totalActiveSpots: string;
  status: PatrolRunStatus;
};

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
  return Number(runNo) === 0 ? "Tanpa Ronde" : String(runNo ?? "-");
}

function toCreatePayload(state: FormState): PatrolRunCreate {
  return {
    placeId: state.placeId.trim(),
    userId: state.userId.trim(),
    attendanceId: state.attendanceId.trim() ? state.attendanceId.trim() : null,
    runNo: state.runNo.trim() ? Number(state.runNo.trim()) : null,
    totalActiveSpots: state.totalActiveSpots.trim() ? Number(state.totalActiveSpots.trim()) : null,
    status: state.status,
  };
}

function toPatchPayload(state: FormState): PatrolRunPatch {
  const payload: PatrolRunPatch = {};
  if (state.runNo.trim()) payload.runNo = Number(state.runNo.trim());
  if (state.totalActiveSpots.trim()) payload.totalActiveSpots = Number(state.totalActiveSpots.trim());
  payload.status = state.status;
  return payload;
}

export default function PatrolRunsPage() {
  const qc = useQueryClient();
  const places = placeHooks.useList({});
  const users = userHooks.useList({});

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const userRows = React.useMemo(() => (users.data ?? []) as User[], [users.data]);
  const placeNameById = React.useMemo(() => new Map(placeRows.map((row) => [row.id, `${row.place_name} (${row.place_code})`])), [placeRows]);
  const userNameById = React.useMemo(() => new Map(userRows.map((row) => [row.id, row.full_name || row.username || row.id])), [userRows]);

  const [placeId, setPlaceId] = React.useState("");
  const [filterUserId, setFilterUserId] = React.useState("");
  const [filterAttendanceId, setFilterAttendanceId] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: PatrolRunSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "started_at",
    sortDirection: "desc",
  });

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const listQuery = useQuery({
    queryKey: ["satpam-patrol-runs-page", placeId, filterUserId, filterAttendanceId, filterStatus, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listPatrolRuns({
        placeId,
        userId: filterUserId.trim() || undefined,
        attendanceId: filterAttendanceId.trim() || undefined,
        status: filterStatus.trim() || undefined,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: PATROL_RUN_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: Boolean(placeId.trim()),
  });

  const createMut = useMutation({
    mutationFn: async (payload: PatrolRunCreate) => createPatrolRun(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-runs-page"] });
    },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PatrolRunPatch }) => updatePatrolRun(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-runs-page"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deletePatrolRun(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-runs-page"] });
    },
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as PatrolRun[], [listQuery.data]);
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

  const [openCreate, setOpenCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<PatrolRun | null>(null);
  const [deleting, setDeleting] = React.useState<PatrolRun | null>(null);
  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    userId: "",
    attendanceId: "",
    runNo: "",
    totalActiveSpots: "",
    status: "active",
  });
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");

  const openCreateForm = () => {
    setForm({
      placeId,
      userId: filterUserId.trim() || userRows[0]?.id || "",
      attendanceId: filterAttendanceId.trim(),
      runNo: "",
      totalActiveSpots: "",
      status: "active",
    });
    setOpenCreate(true);
  };

  const openEditForm = (row: PatrolRun) => {
    setForm({
      placeId: row.place_id,
      userId: row.user_id,
      attendanceId: row.attendance_id ?? "",
      runNo: String(row.run_no),
      totalActiveSpots: String(row.total_active_spots),
      status: row.status === "completed" ? "completed" : "active",
    });
    setEditing(row);
  };

  const submitCreate = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.userId.trim()) throw new Error("User wajib dipilih.");
      await createMut.mutateAsync(toCreatePayload(form));
      setOpenCreate(false);
      setSuccessText("Patrol run berhasil dibuat.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal membuat patrol run.");
      setErrorOpen(true);
    }
  };

  const submitUpdate = async () => {
    if (!editing) return;
    try {
      await updateMut.mutateAsync({ id: editing.id, data: toPatchPayload(form) });
      setEditing(null);
      setSuccessText("Patrol run berhasil diperbarui.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal memperbarui patrol run.");
      setErrorOpen(true);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      setDeleting(null);
      setSuccessText("Patrol run berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus patrol run.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<PatrolRun>[]>(() => [
    { key: "run_no", header: "Ronde", sortable: true, className: "w-[120px]", render: (row) => formatRunLabel(row.run_no) },
    { key: "user_id", header: "User", className: "w-[220px]", render: (row) => userNameById.get(row.user_id) ?? row.user_id },
    { key: "attendance_id", header: "Attendance", className: "w-[220px]", render: (row) => row.attendance_id || "-" },
    { key: "status", header: "Status", sortable: true, className: "w-[110px]", render: (row) => row.status.toUpperCase() },
    {
      key: "progress",
      header: "Progress",
      className: "w-[160px]",
      render: (row) => `${row.unique_scanned_spots}/${row.total_active_spots} spot | ${row.scan_count} scan`,
    },
    { key: "started_at", header: "Started", sortable: true, className: "w-[180px]", render: (row) => formatDateTime(row.started_at) },
    { key: "completed_at", header: "Completed", sortable: true, className: "w-[180px]", render: (row) => formatDateTime(row.completed_at) },
    {
      key: "actions",
      header: "Actions",
      className: "w-[180px]",
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="secondary" className="h-8 px-3 text-[12px]" onClick={() => openEditForm(row)}>
            Edit
          </Button>
          <Button variant="secondary" className="h-8 px-3 text-[12px]" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ], [userNameById]);

  return (
    <>
      <PageHeader
        title="Patrol Runs"
        description="CRUD ronde patroli, termasuk bucket master Tanpa Ronde."
        actions={<Button onClick={openCreateForm} disabled={!placeId.trim()}>+ Create Run</Button>}
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            {placeRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.place_name} ({row.place_code})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Filter User</span>
          <select
            value={filterUserId}
            onChange={(e) => {
              setFilterUserId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">Semua user</option>
            {userRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.full_name || row.username || row.id}
              </option>
            ))}
          </select>
        </label>

        <TextField
          label="Filter Attendance ID"
          value={filterAttendanceId}
          onChange={(e) => {
            setFilterAttendanceId(e.target.value);
            setTableState((prev) => ({ ...prev, page: 1 }));
          }}
          placeholder="UUID attendance"
        />

        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Filter Status</span>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">Semua status</option>
            <option value="active">ACTIVE</option>
            <option value="completed">COMPLETED</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {places.isLoading || users.isLoading ? (
          <LoadingStateCard title="Loading master data..." subtitle="Place dan user sedang dimuat." />
        ) : places.error || users.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {(places.error ?? users.error) instanceof Error ? (places.error ?? users.error)!.message : "Gagal load master data."}
          </div>
        ) : !placeId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih place.</div>
        ) : listQuery.isLoading ? (
          <LoadingStateCard title="Loading patrol runs..." subtitle={`Memuat ronde patroli di ${placeNameById.get(placeId) ?? "place aktif"}.`} />
        ) : listQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {listQuery.error instanceof Error ? listQuery.error.message : "Gagal load patrol runs."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            defaultPageSize={10}
            emptyMessage="Belum ada patrol run."
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
                if (
                  sortKey !== "run_no"
                  && sortKey !== "status"
                  && sortKey !== "started_at"
                  && sortKey !== "completed_at"
                  && sortKey !== "created_at"
                  && sortKey !== "total_active_spots"
                ) return;
                setTableState((prev) => ({ ...prev, page: 1, sortKey, sortDirection }));
              },
            }}
          />
        )}
      </div>

      <ConfirmModalMaster
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onConfirm={submitCreate}
        moduleLabel="Patrol Runs"
        action="create"
        title="Create Patrol Run"
        message={
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">User</span>
              <select
                value={form.userId}
                onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih user</option>
                {userRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.full_name || row.username || row.id}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Attendance ID" value={form.attendanceId} onChange={(e) => setForm((prev) => ({ ...prev, attendanceId: e.target.value }))} placeholder="Opsional UUID attendance" />
            <TextField label="Ronde" type="number" min={1} value={form.runNo} onChange={(e) => setForm((prev) => ({ ...prev, runNo: e.target.value }))} placeholder="Auto jika kosong" />
            <TextField label="Total Active Spots" type="number" min={0} value={form.totalActiveSpots} onChange={(e) => setForm((prev) => ({ ...prev, totalActiveSpots: e.target.value }))} placeholder="Auto dari route aktif jika kosong" />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as PatrolRunStatus }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="active">ACTIVE</option>
                <option value="completed">COMPLETED</option>
              </select>
            </label>
          </div>
        }
        confirmLabel={createMut.isPending ? "Creating..." : "Create"}
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onConfirm={submitUpdate}
        moduleLabel="Patrol Runs"
        action="edit"
        title="Edit Patrol Run"
        message={
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>Place: {editing ? (placeNameById.get(editing.place_id) ?? editing.place_id) : "-"}</div>
              <div>User: {editing ? (userNameById.get(editing.user_id) ?? editing.user_id) : "-"}</div>
              <div>Attendance: {editing?.attendance_id || "-"}</div>
            </div>
            <TextField label="Ronde" type="number" min={1} value={form.runNo} onChange={(e) => setForm((prev) => ({ ...prev, runNo: e.target.value }))} />
            <TextField label="Total Active Spots" type="number" min={0} value={form.totalActiveSpots} onChange={(e) => setForm((prev) => ({ ...prev, totalActiveSpots: e.target.value }))} />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as PatrolRunStatus }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="active">ACTIVE</option>
                <option value="completed">COMPLETED</option>
              </select>
            </label>
          </div>
        }
        confirmLabel={updateMut.isPending ? "Saving..." : "Save"}
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={submitDelete}
        moduleLabel="Patrol Runs"
        action="delete"
        title="Delete Patrol Run"
        message={
          <div className="space-y-2 text-sm text-slate-700">
            <div>Run ini akan dihapus bersama scan yang terhubung.</div>
            <div className="font-semibold">
              {deleting ? `${formatRunLabel(deleting.run_no)} | ${userNameById.get(deleting.user_id) ?? deleting.user_id}` : ""}
            </div>
          </div>
        }
        confirmLabel={deleteMut.isPending ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Patrol Runs" variant="create" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Patrol Runs" variant="create" title="Error" message={errorText} />
    </>
  );
}
