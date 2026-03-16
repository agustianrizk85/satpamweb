"use client";

import * as React from "react";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { Shift } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";

import type { SpotAssignment, SpotAssignmentCreate, SpotAssignmentPatch } from "@/repository/spot-assignments";
import { spotAssignmentHooks } from "@/repository/spot-assignments";

type FormState = {
  placeId: string;
  userId: string;
  shiftId: string;
  isActive: boolean;
};

type SpotAssignmentSortColumn = "place_id" | "user_id" | "shift_id" | "is_active" | "created_at";

const SPOT_ASSIGNMENT_SORT_BY_MAP: Record<SpotAssignmentSortColumn, "placeId" | "userId" | "shiftId" | "isActive" | "createdAt"> = {
  place_id: "placeId",
  user_id: "userId",
  shift_id: "shiftId",
  is_active: "isActive",
  created_at: "createdAt",
};

function toCreatePayload(s: FormState): SpotAssignmentCreate {
  return {
    placeId: s.placeId,
    userId: s.userId,
    shiftId: s.shiftId,
    isActive: s.isActive,
  };
}

function toPatchPayload(s: FormState): SpotAssignmentPatch {
  return {
    placeId: s.placeId,
    userId: s.userId,
    shiftId: s.shiftId,
    isActive: s.isActive,
  };
}

export default function SpotAssignmentsPage() {
  const places = placeHooks.useList({});
  const shifts = shiftHooks.useList({});
  const users = userHooks.useList({});

  const [filterPlaceId, setFilterPlaceId] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: SpotAssignmentSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "created_at",
    sortDirection: "desc",
  });
  const list = spotAssignmentHooks.useList({
    placeId: filterPlaceId.trim() ? filterPlaceId : undefined,
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: SPOT_ASSIGNMENT_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });

  const createMut = spotAssignmentHooks.useCreate();
  const updateMut = spotAssignmentHooks.useUpdate();
  const removeMut = spotAssignmentHooks.useRemove();

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const shiftRows = React.useMemo(() => (shifts.data ?? []) as Shift[], [shifts.data]);
  const userRows = React.useMemo(() => (users.data ?? []) as User[], [users.data]);
  const rows = React.useMemo(() => (list.data ?? []) as SpotAssignment[], [list.data]);
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

  const placeNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of placeRows) m.set(p.id, `${p.place_name ?? p.place_code}`);
    return m;
  }, [placeRows]);

  const shiftNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shiftRows) m.set(s.id, s.name ?? s.id);
    return m;
  }, [shiftRows]);

  const userNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of userRows) m.set(u.id, u.full_name ?? u.username ?? u.id);
    return m;
  }, [userRows]);

  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selected, setSelected] = React.useState<SpotAssignment | null>(null);

  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    userId: "",
    shiftId: "",
    isActive: true,
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const onClickCreate = () => {
    const defPlace = filterPlaceId || placeRows[0]?.id || "";
    const defUser = userRows[0]?.id ?? "";
    const defShift = shiftRows[0]?.id ?? "";

    setMode("create");
    setSelected(null);
    setForm({
      placeId: defPlace,
      userId: defUser,
      shiftId: defShift,
      isActive: true,
    });
    setOpenForm(true);
  };

  const onClickEdit = (r: SpotAssignment) => {
    setMode("edit");
    setSelected(r);
    setForm({
      placeId: r.place_id,
      userId: r.user_id,
      shiftId: r.shift_id,
      isActive: Boolean(r.is_active),
    });
    setOpenForm(true);
  };

  const onClickDelete = (r: SpotAssignment) => {
    setSelected(r);
    setConfirmDeleteOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.userId.trim()) throw new Error("User wajib dipilih.");
      if (!form.shiftId.trim()) throw new Error("Shift wajib dipilih.");

      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(form));
        setSuccessText("Assignment berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Assignment berhasil diubah.");
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
      setSuccessText("Assignment berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<SpotAssignment>[]>(() => {
    return [
      { key: "place_id", header: "Place", sortable: true, render: (r) => placeNameById.get(r.place_id) ?? r.place_id },
      { key: "user_id", header: "User", sortable: true, render: (r) => userNameById.get(r.user_id) ?? r.user_id },
      { key: "shift_id", header: "Shift", sortable: true, render: (r) => shiftNameById.get(r.shift_id) ?? r.shift_id },
      { key: "is_active", header: "Active", sortable: true, className: "w-[110px]", render: (r) => (r.is_active ? "YES" : "NO") },
      {
        key: "created_at",
        header: "Created At",
        sortable: true,
        className: "w-[190px]",
        render: (r) => {
          const d = new Date(r.created_at);
          if (Number.isNaN(d.getTime())) return r.created_at;
          return d.toLocaleString("id-ID");
        },
      },
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
  }, [placeNameById, shiftNameById, userNameById]);

  const anyLoading = places.isLoading || shifts.isLoading || users.isLoading;
  const anyError = places.error ?? shifts.error ?? users.error;

  return (
    <>
      <PageHeader
        title="Spot Assignments"
        description="Penugasan user per place + shift."
        actions={<Button onClick={onClickCreate}>+ Create</Button>}
      />

      <div className="mb-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Filter Place</span>
          <select
            value={filterPlaceId}
            onChange={(e) => {
              setFilterPlaceId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">All</option>
            {placeRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.place_name} ({p.place_code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {anyLoading ? (
          <LoadingStateCard title="Loading master data..." subtitle="Place, user, dan shift sedang dimuat." />
        ) : anyError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {anyError instanceof Error ? anyError.message : "Gagal load master data."}
          </div>
        ) : list.isLoading ? (
          <LoadingStateCard title="Loading spot assignments..." subtitle="Penugasan spot sedang dimuat." />
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
            emptyMessage="Belum ada assignment."
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
                  sortKey !== "place_id" &&
                  sortKey !== "user_id" &&
                  sortKey !== "shift_id" &&
                  sortKey !== "is_active" &&
                  sortKey !== "created_at"
                ) {
                  return;
                }
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
        moduleLabel="Spot Assignments"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create Assignment" : "Edit Assignment"}
        message={
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
              <select
                value={form.placeId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    placeId: e.target.value,
                  }))
                }
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
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih user</option>
                {userRows.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Shift</span>
              <select
                value={form.shiftId}
                onChange={(e) => setForm((p) => ({ ...p, shiftId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih shift</option>
                {shiftRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time}-{s.end_time})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Active</span>
              <select
                value={String(form.isActive)}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === "true" }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="true">YES</option>
                <option value="false">NO</option>
              </select>
            </label>
          </div>
        }
        confirmLabel={mode === "create" ? "Create" : "Save"}
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        moduleLabel="Spot Assignments"
        action="delete"
        title="Delete Assignment"
        message={
          <div>
            Yakin hapus assignment <b>{userNameById.get(selected?.user_id ?? "") ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Spot Assignments" variant={mode === "create" ? "create" : "edit"} title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Spot Assignments" variant={mode === "create" ? "create" : "edit"} title="Error" message={errorText} />
    </>
  );
}
