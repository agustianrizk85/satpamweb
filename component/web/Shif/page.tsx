"use client";

import * as React from "react";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { Shift, ShiftCreate, ShiftPatch } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";

type FormState = {
  placeId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type ShiftSortColumn = "name" | "start_time" | "end_time" | "is_active";

const SHIFT_SORT_BY_MAP: Record<ShiftSortColumn, "name" | "startTime" | "endTime" | "isActive"> = {
  name: "name",
  start_time: "startTime",
  end_time: "endTime",
  is_active: "isActive",
};

function toCreatePayload(state: FormState): ShiftCreate {
  return {
    placeId: state.placeId,
    name: state.name.trim(),
    startTime: state.startTime,
    endTime: state.endTime,
    isActive: state.isActive,
  };
}

function toPatchPayload(state: FormState): ShiftPatch {
  return {
    placeId: state.placeId,
    name: state.name.trim(),
    startTime: state.startTime,
    endTime: state.endTime,
    isActive: state.isActive,
  };
}

export default function ShiftsPage() {
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: ShiftSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "name",
    sortDirection: "asc",
  });

  const list = shiftHooks.useList({
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: SHIFT_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });
  const places = placeHooks.useList({});
  const createMut = shiftHooks.useCreate();
  const updateMut = shiftHooks.useUpdate();
  const removeMut = shiftHooks.useRemove();

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const rows = React.useMemo(() => (list.data ?? []) as Shift[], [list.data]);
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
    const map = new Map<string, string>();
    for (const p of placeRows) map.set(p.id, p.place_name ?? p.place_code ?? p.id);
    return map;
  }, [placeRows]);

  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selected, setSelected] = React.useState<Shift | null>(null);

  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    isActive: true,
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const onClickCreate = () => {
    const defaultPlaceId = placeRows[0]?.id ?? "";
    setMode("create");
    setSelected(null);
    setForm({ placeId: defaultPlaceId, name: "", startTime: "08:00", endTime: "17:00", isActive: true });
    setOpenForm(true);
  };

  const onClickEdit = (s: Shift) => {
    setMode("edit");
    setSelected(s);
    setForm({
      placeId: s.place_id ?? "",
      name: s.name ?? "",
      startTime: s.start_time ?? "08:00",
      endTime: s.end_time ?? "17:00",
      isActive: Boolean(s.is_active),
    });
    setOpenForm(true);
  };

  const onClickDelete = (s: Shift) => {
    setSelected(s);
    setConfirmDeleteOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");

      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(form));
        setSuccessText("Shift berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Shift berhasil diubah.");
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
      setSuccessText("Shift berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<Shift>[]>(() => {
    return [
      {
        key: "place_id",
        header: "Place",
        render: (r) => placeNameById.get(r.place_id) ?? r.place_id,
      },
      { key: "name", header: "Name", sortable: true },
      { key: "start_time", header: "Start", sortable: true, className: "w-[140px]" },
      { key: "end_time", header: "End", sortable: true, className: "w-[140px]" },
      {
        key: "is_active",
        header: "Active",
        sortable: true,
        className: "w-[120px]",
        render: (r) => (r.is_active ? "YES" : "NO"),
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
  }, [placeNameById]);

  return (
    <>
      <PageHeader title="Shifts" description="Master shift kerja." actions={<Button onClick={onClickCreate}>+ Create</Button>} />

      <div className="space-y-3">
        {list.isLoading || places.isLoading ? (
          <LoadingStateCard title="Loading shifts..." subtitle="Data shift dan place sedang dimuat." />
        ) : list.error || places.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {list.error instanceof Error
              ? list.error.message
              : places.error instanceof Error
                ? places.error.message
                : "Gagal load data."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(r) => r.id}
            defaultPageSize={10}
            emptyMessage="Belum ada shift."
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
                if (sortKey !== "name" && sortKey !== "start_time" && sortKey !== "end_time" && sortKey !== "is_active") return;
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
        moduleLabel="Shifts"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create Shift" : "Edit Shift"}
        message={
          <div className="mt-4 grid gap-3">
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

            <TextField label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Shift Pagi" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField type="time" label="Start Time" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
              <TextField type="time" label="End Time" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
            </div>

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
        moduleLabel="Shifts"
        action="delete"
        title="Delete Shift"
        message={
          <div>
            Yakin hapus shift <b>{selected?.name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Shifts" variant={mode === "create" ? "create" : "edit"} title="Success" message={successText} />

      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Shifts" variant={mode === "create" ? "create" : "edit"} title="Error" message={errorText} />
    </>
  );
}
