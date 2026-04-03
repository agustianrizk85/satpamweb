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
import type { PatrolRoundMaster, PatrolRoundMasterCreate, PatrolRoundMasterPatch } from "@/repository/patrol-round-masters";
import {
  createPatrolRoundMaster,
  deletePatrolRoundMaster,
  listPatrolRoundMasters,
  updatePatrolRoundMaster,
} from "@/repository/patrol-round-masters";

type PatrolRoundMasterSortColumn = "round_no" | "is_active" | "created_at" | "updated_at";

const SORT_BY_MAP: Record<PatrolRoundMasterSortColumn, "roundNo" | "isActive" | "createdAt" | "updatedAt"> = {
  round_no: "roundNo",
  is_active: "isActive",
  created_at: "createdAt",
  updated_at: "updatedAt",
};

type FormState = {
  placeId: string;
  roundNo: string;
  isActive: boolean;
};

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
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

function toCreatePayload(state: FormState): PatrolRoundMasterCreate {
  return {
    placeId: state.placeId.trim(),
    roundNo: Number(state.roundNo.trim()),
    isActive: state.isActive,
  };
}

function toPatchPayload(state: FormState): PatrolRoundMasterPatch {
  return {
    roundNo: Number(state.roundNo.trim()),
    isActive: state.isActive,
  };
}

export default function PatrolRoundMastersPage() {
  const qc = useQueryClient();
  const places = placeHooks.useList({});
  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const placeNameById = React.useMemo(() => new Map(placeRows.map((row) => [row.id, `${row.place_name} (${row.place_code})`])), [placeRows]);

  const [placeId, setPlaceId] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: PatrolRoundMasterSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "round_no",
    sortDirection: "asc",
  });

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const listQuery = useQuery({
    queryKey: ["satpam-patrol-round-masters-page", placeId, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listPatrolRoundMasters({
        placeId,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: Boolean(placeId.trim()),
  });

  const createMut = useMutation({
    mutationFn: async (payload: PatrolRoundMasterCreate) => createPatrolRoundMaster(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-round-masters-page"] });
    },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PatrolRoundMasterPatch }) => updatePatrolRoundMaster(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-round-masters-page"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deletePatrolRoundMaster(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-patrol-round-masters-page"] });
    },
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as PatrolRoundMaster[], [listQuery.data]);
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
  const [editing, setEditing] = React.useState<PatrolRoundMaster | null>(null);
  const [deleting, setDeleting] = React.useState<PatrolRoundMaster | null>(null);
  const [form, setForm] = React.useState<FormState>({ placeId: "", roundNo: "", isActive: true });
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");

  const openCreateForm = () => {
    setForm({ placeId, roundNo: "", isActive: true });
    setOpenCreate(true);
  };

  const openEditForm = (row: PatrolRoundMaster) => {
    setForm({
      placeId: row.place_id,
      roundNo: String(row.round_no),
      isActive: row.is_active,
    });
    setEditing(row);
  };

  const submitCreate = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.roundNo.trim() || Number(form.roundNo.trim()) < 1) throw new Error("Nomor ronde wajib >= 1.");
      await createMut.mutateAsync(toCreatePayload(form));
      setOpenCreate(false);
      setSuccessText("Master ronde berhasil dibuat.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal membuat master ronde.");
      setErrorOpen(true);
    }
  };

  const submitUpdate = async () => {
    if (!editing) return;
    try {
      if (!form.roundNo.trim() || Number(form.roundNo.trim()) < 1) throw new Error("Nomor ronde wajib >= 1.");
      await updateMut.mutateAsync({ id: editing.id, data: toPatchPayload(form) });
      setEditing(null);
      setSuccessText("Master ronde berhasil diperbarui.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal memperbarui master ronde.");
      setErrorOpen(true);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      setDeleting(null);
      setSuccessText("Master ronde berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus master ronde.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<PatrolRoundMaster>[]>(() => [
    { key: "round_no", header: "Ronde", sortable: true, className: "w-[100px]" },
    { key: "is_active", header: "Active", sortable: true, className: "w-[120px]", render: (row) => row.is_active ? "YES" : "NO" },
    { key: "created_at", header: "Created", sortable: true, className: "w-[180px]", render: (row) => formatDateTime(row.created_at) },
    { key: "updated_at", header: "Updated", sortable: true, className: "w-[180px]", render: (row) => formatDateTime(row.updated_at) },
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
  ], []);

  return (
    <>
      <PageHeader
        title="Master Ronde"
        description="Nomor ronde tetap per place. User nanti mengisi transaksi scan berdasarkan master ronde ini."
        actions={<Button onClick={openCreateForm} disabled={!placeId.trim()}>+ Create Ronde</Button>}
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] lg:grid-cols-2">
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
      </div>

      <div className="space-y-3">
        {places.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place sedang dimuat." />
        ) : places.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {places.error instanceof Error ? places.error.message : "Gagal load places."}
          </div>
        ) : !placeId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih place.</div>
        ) : listQuery.isLoading ? (
          <LoadingStateCard title="Loading master ronde..." subtitle={`Memuat master ronde di ${placeNameById.get(placeId) ?? "place aktif"}.`} />
        ) : listQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {listQuery.error instanceof Error ? listQuery.error.message : "Gagal load master ronde."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            defaultPageSize={10}
            emptyMessage="Belum ada master ronde."
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
                if (sortKey !== "round_no" && sortKey !== "is_active" && sortKey !== "created_at" && sortKey !== "updated_at") return;
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
        moduleLabel="Master Ronde"
        action="create"
        title="Create Master Ronde"
        message={
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Place: {placeNameById.get(form.placeId) ?? form.placeId ?? "-"}
            </div>
            <TextField label="Nomor Ronde" type="number" min={1} value={form.roundNo} onChange={(e) => setForm((prev) => ({ ...prev, roundNo: e.target.value }))} placeholder="1" />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Active</span>
              <select
                value={String(form.isActive)}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="true">YES</option>
                <option value="false">NO</option>
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
        moduleLabel="Master Ronde"
        action="edit"
        title="Edit Master Ronde"
        message={
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Place: {editing ? (placeNameById.get(editing.place_id) ?? editing.place_id) : "-"}
            </div>
            <TextField label="Nomor Ronde" type="number" min={1} value={form.roundNo} onChange={(e) => setForm((prev) => ({ ...prev, roundNo: e.target.value }))} />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Active</span>
              <select
                value={String(form.isActive)}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="true">YES</option>
                <option value="false">NO</option>
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
        moduleLabel="Master Ronde"
        action="delete"
        title="Delete Master Ronde"
        message={
          <div className="space-y-2 text-sm text-slate-700">
            <div>Master ronde ini akan dihapus.</div>
            <div className="font-semibold">
              {deleting ? `Ronde ${deleting.round_no}` : ""}
            </div>
          </div>
        }
        confirmLabel={deleteMut.isPending ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Master Ronde" variant="create" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Master Ronde" variant="create" title="Error" message={errorText} />
    </>
  );
}
