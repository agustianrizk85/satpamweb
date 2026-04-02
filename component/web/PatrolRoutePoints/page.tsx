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
import type { Spot } from "@/repository/Spots";
import { spotHooks } from "@/repository/Spots";

import type { PatrolRoutePoint, PatrolRoutePointCreate } from "@/repository/patrol-route-points";
import { deletePatrolRoutePoint, patrolRoutePointHooks } from "@/repository/patrol-route-points";

type FormState = {
  placeId: string;
  spotId: string;
  seq: string;
  isActive: boolean;
};

type PatrolRoutePointSortColumn = "seq" | "spot_id" | "is_active" | "created_at";

const PATROL_ROUTE_POINT_SORT_BY_MAP: Record<PatrolRoutePointSortColumn, "seq" | "spotId" | "isActive" | "createdAt"> = {
  seq: "seq",
  spot_id: "spotId",
  is_active: "isActive",
  created_at: "createdAt",
};

function toCreatePayload(s: FormState): PatrolRoutePointCreate {
  const n = Number(s.seq.trim());
  if (!Number.isFinite(n) || n < 1) throw new Error("Seq harus angka >= 1.");
  return {
    placeId: s.placeId,
    spotId: s.spotId,
    seq: n,
    isActive: s.isActive,
  };
}

export default function PatrolRoutePointsPage() {
  const places = placeHooks.useList({});
  const spots = spotHooks.useList({});

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const spotRows = React.useMemo(() => (spots.data ?? []) as Spot[], [spots.data]);

  const [placeId, setPlaceId] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: PatrolRoutePointSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "seq",
    sortDirection: "asc",
  });

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const list = patrolRoutePointHooks.useList(
    placeId.trim()
      ? {
          placeId,
          page: tableState.page,
          pageSize: tableState.pageSize,
          sortBy: PATROL_ROUTE_POINT_SORT_BY_MAP[tableState.sortKey],
          sortOrder: tableState.sortDirection,
        }
      : ({ placeId: "" } as { placeId: string }),
  );

  const createMut = patrolRoutePointHooks.useCreate();
  const [deleteTarget, setDeleteTarget] = React.useState<PatrolRoutePoint | null>(null);

  const rows = React.useMemo(() => (list.data ?? []) as PatrolRoutePoint[], [list.data]);
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

  const spotNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spotRows) {
      const spotName = s.name ?? s.spot_name ?? s.id;
      const spotCode = s.code ?? s.spot_code ?? "-";
      m.set(s.id, `${spotName} (${spotCode})`);
    }
    return m;
  }, [spotRows]);

  const [openForm, setOpenForm] = React.useState(false);

  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    spotId: "",
    seq: "1",
    isActive: true,
  });

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const filteredSpots = React.useMemo(() => {
    const pid = placeId.trim();
    if (!pid) return [];
    return spotRows.filter((s) => s.place_id === pid);
  }, [placeId, spotRows]);

  const onClickCreate = () => {
    const defSpot = filteredSpots[0]?.id ?? "";
    setForm({ placeId, spotId: defSpot, seq: "1", isActive: true });
    setOpenForm(true);
  };

  const submit = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.spotId.trim()) throw new Error("Spot wajib dipilih.");
      await createMut.mutateAsync(toCreatePayload(form));
      setOpenForm(false);
      setSuccessText("Route point berhasil dibuat.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePatrolRoutePoint({ id: deleteTarget.id, placeId: deleteTarget.place_id });
      setDeleteTarget(null);
      await list.refetch();
      setSuccessText("Route point berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus route point.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<PatrolRoutePoint>[]>(() => {
    return [
      { key: "seq", header: "Seq", sortable: true, className: "w-[100px]" },
      { key: "spot_id", header: "Spot", render: (r) => spotNameById.get(r.spot_id) ?? r.spot_id },
      { key: "is_active", header: "Active", sortable: true, className: "w-[120px]", render: (r) => (r.is_active ? "YES" : "NO") },
      { key: "created_at", header: "Created", className: "w-[200px]" },
      {
        key: "actions",
        header: "Actions",
        className: "w-[140px]",
        render: (r) => (
          <Button
            variant="secondary"
            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            onClick={() => setDeleteTarget(r)}
          >
            Delete
          </Button>
        ),
      },
    ];
  }, [spotNameById]);

  return (
    <>
      <PageHeader
        title="Patrol Route Points"
        description="Urutan spot patroli per place."
        actions={<Button onClick={onClickCreate} disabled={!placeId.trim()}>+ Create</Button>}
      />

      <div className="mb-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">
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
            {placeRows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.place_name} ({p.place_code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {places.isLoading || spots.isLoading ? (
          <LoadingStateCard title="Loading master data..." subtitle="Place dan spot patroli sedang dimuat." />
        ) : places.error || spots.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {(places.error ?? spots.error) instanceof Error ? (places.error ?? spots.error)!.message : "Gagal load master data."}
          </div>
        ) : !placeId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih place.</div>
        ) : list.isLoading ? (
          <LoadingStateCard title="Loading route points..." subtitle="Urutan titik patroli sedang dimuat." />
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
            emptyMessage="Belum ada route point."
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
                if (sortKey !== "seq" && sortKey !== "spot_id" && sortKey !== "is_active" && sortKey !== "created_at") return;
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
        moduleLabel="Patrol Route Points"
        action="create"
        title="Create Route Point"
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

            <TextField type="number" min={1} label="Seq" value={form.seq} onChange={(e) => setForm((p) => ({ ...p, seq: e.target.value }))} placeholder="1" />

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
        confirmLabel="Create"
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={submitDelete}
        moduleLabel="Patrol Route Points"
        action="delete"
        title="Delete Route Point"
        message={
          <div className="text-sm text-slate-700">
            Yakin hapus route point
            {" "}
            <b>{deleteTarget ? (spotNameById.get(deleteTarget.spot_id) ?? deleteTarget.spot_id) : "-"}</b>
            ?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Patrol Route Points" variant="create" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Patrol Route Points" variant="create" title="Error" message={errorText} />
    </>
  );
}
