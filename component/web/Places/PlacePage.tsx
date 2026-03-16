"use client";

import * as React from "react";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place, PlaceCreate, PlacePatch, PlaceStatus } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";

type FormState = {
  placeCode: string;
  placeName: string;
  address: string;
  latitude: string;
  longitude: string;
  status: PlaceStatus;
};

type PlaceSortColumn = "place_code" | "place_name" | "status";

const PLACE_SORT_BY_MAP: Record<PlaceSortColumn, "placeCode" | "placeName" | "status"> = {
  place_code: "placeCode",
  place_name: "placeName",
  status: "status",
};

function toNullableNumber(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toCreatePayload(state: FormState): PlaceCreate {
  return {
    placeCode: state.placeCode.trim(),
    placeName: state.placeName.trim(),
    address: state.address.trim() ? state.address.trim() : null,
    latitude: toNullableNumber(state.latitude),
    longitude: toNullableNumber(state.longitude),
    status: state.status,
  };
}

function toPatchPayload(state: FormState): PlacePatch {
  return {
    placeCode: state.placeCode.trim(),
    placeName: state.placeName.trim(),
    address: state.address.trim() ? state.address.trim() : null,
    latitude: toNullableNumber(state.latitude),
    longitude: toNullableNumber(state.longitude),
    status: state.status,
  };
}

export default function PlacesPage() {
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: PlaceSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "place_code",
    sortDirection: "asc",
  });

  const list = placeHooks.useList({
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: PLACE_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });
  const createMut = placeHooks.useCreate();
  const updateMut = placeHooks.useUpdate();
  const removeMut = placeHooks.useRemove();

  const rows = React.useMemo(() => (list.data ?? []) as Place[], [list.data]);
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

  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selected, setSelected] = React.useState<Place | null>(null);

  const [form, setForm] = React.useState<FormState>({
    placeCode: "",
    placeName: "",
    address: "",
    latitude: "",
    longitude: "",
    status: "ACTIVE",
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const onClickCreate = () => {
    setMode("create");
    setSelected(null);
    setForm({ placeCode: "", placeName: "", address: "", latitude: "", longitude: "", status: "ACTIVE" });
    setOpenForm(true);
  };

  const onClickEdit = (p: Place) => {
    setMode("edit");
    setSelected(p);
    setForm({
      placeCode: p.place_code ?? "",
      placeName: p.place_name ?? "",
      address: p.address ?? "",
      latitude: p.latitude === null || p.latitude === undefined ? "" : String(p.latitude),
      longitude: p.longitude === null || p.longitude === undefined ? "" : String(p.longitude),
      status: p.status ?? "ACTIVE",
    });
    setOpenForm(true);
  };

  const onClickDelete = (p: Place) => {
    setSelected(p);
    setConfirmDeleteOpen(true);
  };

  const submit = async () => {
    try {
      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(form));
        setSuccessText("Place berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Place berhasil diubah.");
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
      setSuccessText("Place berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<Place>[]>(() => {
    return [
      { key: "place_code", header: "Code", sortable: true, className: "w-[180px]" },
      { key: "place_name", header: "Name", sortable: true },
      { key: "status", header: "Status", sortable: true, className: "w-[120px]" },
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
  }, []);

  return (
    <>
      <PageHeader
        title="Places"
        description="Master site/tempat."
        actions={<Button onClick={onClickCreate}>+ Create</Button>}
      />

      <div className="space-y-3">
        {list.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Data place sedang dimuat." />
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
            emptyMessage="Belum ada place."
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
                if (sortKey !== "place_code" && sortKey !== "place_name" && sortKey !== "status") return;
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
        moduleLabel="Places"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create Place" : "Edit Place"}
        message={
          <div className="mt-4 grid gap-3">
            <TextField
              label="Place Code"
              value={form.placeCode}
              onChange={(e) => setForm((p) => ({ ...p, placeCode: e.target.value }))}
              placeholder="SITE-01"
            />
            <TextField
              label="Place Name"
              value={form.placeName}
              onChange={(e) => setForm((p) => ({ ...p, placeName: e.target.value }))}
              placeholder="Pabrik A"
            />
            <TextField
              label="Address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Jl. ..."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Latitude"
                value={form.latitude}
                onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                placeholder="-6.2"
                inputMode="decimal"
              />
              <TextField
                label="Longitude"
                value={form.longitude}
                onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                placeholder="106.8"
                inputMode="decimal"
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as PlaceStatus }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
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
        moduleLabel="Places"
        action="delete"
        title="Delete Place"
        message={
          <div>
            Yakin hapus place <b>{selected?.place_name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        moduleLabel="Places"
        variant={mode === "create" ? "create" : "edit"}
        title="Success"
        message={successText}
      />

      <ErrorModalMaster
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        moduleLabel="Places"
        variant={mode === "create" ? "create" : "edit"}
        title="Error"
        message={errorText}
      />
    </>
  );
}
