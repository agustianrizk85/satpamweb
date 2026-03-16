"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import QRCode from "qrcode";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { Spot, SpotCreate, SpotPatch, SpotStatus } from "@/repository/Spots";
import { spotHooks } from "@/repository/Spots";

type FormState = {
  placeId: string;
  code: string;
  name: string;
  qrToken: string;
  latitude: string;
  longitude: string;
  status: SpotStatus;
};

type SpotSortColumn = "code" | "name" | "status";

const SPOT_SORT_BY_MAP: Record<SpotSortColumn, "spotCode" | "spotName" | "status"> = {
  code: "spotCode",
  name: "spotName",
  status: "status",
};

function toNullableNumber(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toCreatePayload(state: FormState): SpotCreate {
  return {
    placeId: state.placeId,
    spotCode: state.code.trim(),
    spotName: state.name.trim(),
    qrToken: state.qrToken.trim(),
    latitude: toNullableNumber(state.latitude),
    longitude: toNullableNumber(state.longitude),
    status: state.status,
  };
}

function toPatchPayload(state: FormState): SpotPatch {
  return {
    placeId: state.placeId,
    spotCode: state.code.trim(),
    spotName: state.name.trim(),
    qrToken: state.qrToken.trim(),
    latitude: toNullableNumber(state.latitude),
    longitude: toNullableNumber(state.longitude),
    status: state.status,
  };
}

function resolveSpotQrPayload(row: Spot): string {
  const token = row.qr_token?.trim();
  if (token) return token;
  return row.id;
}

export default function SpotsPage() {
  const places = placeHooks.useList({});
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: SpotSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "code",
    sortDirection: "asc",
  });

  const list = spotHooks.useList({
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: SPOT_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });

  const createMut = spotHooks.useCreate();
  const updateMut = spotHooks.useUpdate();
  const removeMut = spotHooks.useRemove();

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const rows = React.useMemo(() => (list.data ?? []) as Spot[], [list.data]);
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
  const [selected, setSelected] = React.useState<Spot | null>(null);

  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    code: "",
    name: "",
    qrToken: "",
    latitude: "",
    longitude: "",
    status: "ACTIVE",
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [qrViewOpen, setQrViewOpen] = React.useState(false);
  const [qrViewSpot, setQrViewSpot] = React.useState<Spot | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = React.useState("");
  const [qrBusy, setQrBusy] = React.useState(false);

  const onClickCreate = () => {
    const defaultPlaceId = placeRows[0]?.id ?? "";
    setMode("create");
    setSelected(null);
    setForm({
      placeId: defaultPlaceId,
      code: "",
      name: "",
      qrToken: "",
      latitude: "",
      longitude: "",
      status: "ACTIVE",
    });
    setOpenForm(true);
  };

  const onClickEdit = (s: Spot) => {
    setMode("edit");
    setSelected(s);
    setForm({
      placeId: s.place_id ?? "",
      code: s.code ?? s.spot_code ?? "",
      name: s.name ?? s.spot_name ?? "",
      qrToken: s.qr_token ?? "",
      latitude: s.latitude === null || s.latitude === undefined ? "" : String(s.latitude),
      longitude: s.longitude === null || s.longitude === undefined ? "" : String(s.longitude),
      status: s.status ?? "ACTIVE",
    });
    setOpenForm(true);
  };

  const onClickDelete = (s: Spot) => {
    setSelected(s);
    setConfirmDeleteOpen(true);
  };

  const generateQrImage = React.useCallback(async (row: Spot): Promise<string> => {
    const payload = resolveSpotQrPayload(row);
    return QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  }, []);

  const onClickViewQr = React.useCallback(
    async (row: Spot) => {
      try {
        setQrBusy(true);
        const dataUrl = await generateQrImage(row);
        setQrViewSpot(row);
        setQrImageDataUrl(dataUrl);
        setQrViewOpen(true);
      } catch (e) {
        setErrorText(e instanceof Error ? e.message : "Gagal generate QR.");
        setErrorOpen(true);
      } finally {
        setQrBusy(false);
      }
    },
    [generateQrImage],
  );

  const onClickDownloadQr = React.useCallback(
    async (row: Spot) => {
      try {
        setQrBusy(true);
        const dataUrl = await generateQrImage(row);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `spot-${row.id}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        setErrorText(e instanceof Error ? e.message : "Gagal download QR.");
        setErrorOpen(true);
      } finally {
        setQrBusy(false);
      }
    },
    [generateQrImage],
  );

  const submit = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.qrToken.trim()) throw new Error("QR Token wajib diisi.");

      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(form));
        setSuccessText("Spot berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Spot berhasil diubah.");
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
      setSuccessText("Spot berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<Spot>[]>(() => {
    return [
      {
        key: "place_id",
        header: "Place",
        sortable: false,
        className: "w-[240px]",
        render: (r) => placeNameById.get(r.place_id) ?? r.place_id,
      },
      {
        key: "code",
        header: "Code",
        sortable: true,
        className: "w-[180px]",
        render: (r) => r.code ?? r.spot_code ?? "-",
      },
      {
        key: "name",
        header: "Name",
        sortable: true,
        render: (r) => r.name ?? r.spot_name ?? "-",
      },
      { key: "status", header: "Status", sortable: true, className: "w-[120px]" },
      {
        key: "actions",
        header: "Actions",
        className: "w-[360px]",
        render: (r) => (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void onClickViewQr(r)} disabled={qrBusy}>
              View QR
            </Button>
            <Button variant="secondary" onClick={() => void onClickDownloadQr(r)} disabled={qrBusy}>
              Download QR
            </Button>
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
  }, [onClickDownloadQr, onClickViewQr, placeNameById, qrBusy]);

  const placesLoading = places.isLoading;
  const placesError = places.error;

  return (
    <>
      <PageHeader title="Spots" description="Master spot di dalam place." actions={<Button onClick={onClickCreate}>+ Create</Button>} />

      <div className="space-y-3">
        {placesLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place spot sedang dimuat." />
        ) : placesError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {placesError instanceof Error ? placesError.message : "Gagal load places."}
          </div>
        ) : list.isLoading ? (
          <LoadingStateCard title="Loading spots..." subtitle="Data spot sedang dimuat." />
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
            emptyMessage="Belum ada spot."
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
                if (sortKey !== "code" && sortKey !== "name" && sortKey !== "status") return;
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
        moduleLabel="Spots"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create Spot" : "Edit Spot"}
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

            <TextField label="Spot Code" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="SPOT-01" />
            <TextField label="Spot Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Gerbang Utama" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <TextField
                label="QR Token"
                value={form.qrToken}
                onChange={(e) => setForm((p) => ({ ...p, qrToken: e.target.value }))}
                placeholder="random-token"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    qrToken: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : p.qrToken,
                  }))
                }
              >
                Generate QR
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Latitude" value={form.latitude} onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))} placeholder="-6.2" inputMode="decimal" />
              <TextField label="Longitude" value={form.longitude} onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))} placeholder="106.8" inputMode="decimal" />
            </div>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as SpotStatus }))}
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
        moduleLabel="Spots"
        action="delete"
        title="Delete Spot"
        message={
          <div>
            Yakin hapus spot <b>{selected?.name ?? selected?.spot_name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      {qrViewOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
            <div className="text-base font-semibold text-slate-900">Spot QR</div>
            <div className="mt-1 text-sm text-slate-700">
              Spot: <b>{qrViewSpot?.name ?? qrViewSpot?.spot_name ?? "-"}</b>
            </div>
            <div className="mt-1 break-all text-xs text-slate-600">Payload: {qrViewSpot ? resolveSpotQrPayload(qrViewSpot) : "-"}</div>

            <div className="mt-4 flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-4">
              {qrImageDataUrl ? (
                <img src={qrImageDataUrl} alt="Spot QR" className="h-64 w-64" />
              ) : (
                <div className="text-sm text-neutral-500">QR belum tersedia.</div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setQrViewOpen(false)}>
                Close
              </Button>
              <Button onClick={() => (qrViewSpot ? void onClickDownloadQr(qrViewSpot) : undefined)} disabled={!qrViewSpot || qrBusy}>
                Download QR
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Spots" variant={mode === "create" ? "create" : "edit"} title="Success" message={successText} />

      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Spots" variant={mode === "create" ? "create" : "edit"} title="Error" message={errorText} />
    </>
  );
}
