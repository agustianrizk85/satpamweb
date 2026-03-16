"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { FacilityCheckSpot } from "@/repository/facility-spots";
import { listFacilitySpots } from "@/repository/facility-spots";

import type { FacilityCheckItem, FacilityCheckItemCreate, FacilityCheckItemPatch } from "@/repository/facility-items";
import { facilityItemHooks, listFacilityItems } from "@/repository/facility-items";

type FormState = {
  itemName: string;
  qrToken: string;
  sortNo: string;
  isRequired: boolean;
  isActive: boolean;
};

type FacilityItemSortColumn = "sort_no" | "item_name" | "is_required" | "is_active";

const FACILITY_ITEM_SORT_BY_MAP: Record<FacilityItemSortColumn, "sortNo" | "itemName" | "isRequired" | "isActive"> = {
  sort_no: "sortNo",
  item_name: "itemName",
  is_required: "isRequired",
  is_active: "isActive",
};

function toCreatePayload(spotId: string, s: FormState): FacilityCheckItemCreate {
  const n = Number(s.sortNo.trim());
  const sortNo = Number.isFinite(n) ? n : undefined;

  return {
    spotId,
    itemName: s.itemName.trim(),
    qrToken: s.qrToken.trim() ? s.qrToken.trim() : undefined,
    sortNo,
    isRequired: s.isRequired,
    isActive: s.isActive,
  };
}

function toPatchPayload(s: FormState): FacilityCheckItemPatch {
  const n = Number(s.sortNo.trim());
  const sortNo = Number.isFinite(n) ? n : undefined;

  return {
    itemName: s.itemName.trim(),
    qrToken: s.qrToken.trim() ? s.qrToken.trim() : null,
    sortNo,
    isRequired: s.isRequired,
    isActive: s.isActive,
  };
}

function resolveItemQrPayload(row: FacilityCheckItem): string {
  const token = row.qr_token?.trim();
  if (token) return token;
  return row.id;
}

export default function FacilityItemsPage() {
  const places = placeHooks.useList({});
  const createMut = facilityItemHooks.useCreate();
  const updateMut = facilityItemHooks.useUpdate();
  const removeMut = facilityItemHooks.useRemove();
  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);

  const [placeId, setPlaceId] = React.useState("");
  const [spotId, setSpotId] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: FacilityItemSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "sort_no",
    sortDirection: "asc",
  });

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const spotListQuery = useQuery({
    queryKey: ["satpam-facility-spots", placeId],
    queryFn: async () => listFacilitySpots({ placeId }),
    enabled: Boolean(placeId.trim()),
  });

  const spotRows = React.useMemo(() => (spotListQuery.data ?? []) as FacilityCheckSpot[], [spotListQuery.data]);

  React.useEffect(() => {
    if (!spotId.trim() && spotRows[0]?.id) setSpotId(spotRows[0].id);
  }, [spotId, spotRows]);

  const itemListQuery = useQuery({
    queryKey: ["satpam-facility-items", spotId, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listFacilityItems({
        spotId,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: FACILITY_ITEM_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: Boolean(spotId.trim()),
  });

  const rows = React.useMemo(() => (itemListQuery.data ?? []) as FacilityCheckItem[], [itemListQuery.data]);
  const listMeta = React.useMemo(() => readListMeta(itemListQuery.data), [itemListQuery.data]);
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<FacilityCheckItem | null>(null);

  const [form, setForm] = React.useState<FormState>({
    itemName: "",
    qrToken: "",
    sortNo: "1",
    isRequired: true,
    isActive: true,
  });

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [feedbackVariant, setFeedbackVariant] = React.useState<"create" | "edit" | "delete">("create");
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [qrViewOpen, setQrViewOpen] = React.useState(false);
  const [qrViewItem, setQrViewItem] = React.useState<FacilityCheckItem | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = React.useState("");
  const [qrBusy, setQrBusy] = React.useState(false);

  const onClickCreate = () => {
    setMode("create");
    setSelected(null);
    setForm({ itemName: "", qrToken: "", sortNo: String(rows.length + 1), isRequired: true, isActive: true });
    setOpenForm(true);
  };

  const onClickEdit = React.useCallback((row: FacilityCheckItem) => {
    setMode("edit");
    setSelected(row);
    setForm({
      itemName: row.item_name ?? "",
      qrToken: row.qr_token ?? "",
      sortNo: row.sort_no === undefined || row.sort_no === null ? "" : String(row.sort_no),
      isRequired: row.is_required,
      isActive: row.is_active,
    });
    setOpenForm(true);
  }, []);

  const submit = async () => {
    try {
      if (!spotId.trim()) throw new Error("Facility spot wajib dipilih.");
      if (!form.itemName.trim()) throw new Error("Item name wajib diisi.");

      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(spotId, form));
        setSuccessText("Facility item berhasil dibuat.");
        setFeedbackVariant("create");
      } else {
        const id = selected?.id;
        if (!id) throw new Error("Facility item tidak ditemukan.");
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Facility item berhasil diubah.");
        setFeedbackVariant("edit");
      }

      setOpenForm(false);
      setSuccessOpen(true);
    } catch (e) {
      setFeedbackVariant(mode);
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const onClickDelete = React.useCallback((r: FacilityCheckItem) => {
    setSelected(r);
    setConfirmDeleteOpen(true);
  }, []);

  const generateQrImage = React.useCallback(async (row: FacilityCheckItem): Promise<string> => {
    const payload = resolveItemQrPayload(row);
    return QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  }, []);

  const onClickViewQr = React.useCallback(
    async (row: FacilityCheckItem) => {
      try {
        setQrBusy(true);
        const dataUrl = await generateQrImage(row);
        setQrViewItem(row);
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
    async (row: FacilityCheckItem) => {
      try {
        setQrBusy(true);
        const dataUrl = await generateQrImage(row);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `facility-item-${row.id}.png`;
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

  const confirmDelete = async () => {
    const id = selected?.id;
    if (!id) return;

    try {
      await removeMut.mutateAsync(id);
      setConfirmDeleteOpen(false);
      setFeedbackVariant("delete");
      setSuccessText("Facility item berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setFeedbackVariant("delete");
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<FacilityCheckItem>[]>(() => {
    return [
      { key: "sort_no", header: "Sort", sortable: true, className: "w-[90px]" },
      { key: "item_name", header: "Item", sortable: true },
      {
        key: "is_required",
        header: "Required",
        sortable: true,
        className: "w-[120px]",
        render: (r) => (r.is_required ? "YES" : "NO"),
      },
      {
        key: "is_active",
        header: "Active",
        sortable: true,
        className: "w-[110px]",
        render: (r) => (r.is_active ? "YES" : "NO"),
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-[340px]",
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
  }, [onClickDelete, onClickDownloadQr, onClickEdit, onClickViewQr, qrBusy]);

  const spotLabelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spotRows) m.set(s.id, `${s.spot_name} (${s.spot_code})`);
    return m;
  }, [spotRows]);

  return (
    <>
      <PageHeader
        title="Facility Items"
        description="Items checklist per facility spot."
        actions={<Button onClick={onClickCreate} disabled={!spotId.trim()}>+ Create</Button>}
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              setSpotId("");
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
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Facility Spot</span>
          <select
            value={spotId}
            onChange={(e) => {
              setSpotId(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            {spotRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.spot_name} ({s.spot_code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {places.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place facility sedang dimuat." />
        ) : places.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {places.error instanceof Error ? places.error.message : "Gagal load places."}
          </div>
        ) : spotListQuery.isLoading ? (
          <LoadingStateCard title="Loading facility spots..." subtitle="Daftar titik checklist facility sedang dimuat." />
        ) : spotListQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {spotListQuery.error instanceof Error ? spotListQuery.error.message : "Gagal load facility spots."}
          </div>
        ) : !spotId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih facility spot.</div>
        ) : itemListQuery.isLoading ? (
          <LoadingStateCard title="Loading facility items..." subtitle="Checklist item facility sedang dimuat." />
        ) : itemListQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {itemListQuery.error instanceof Error ? itemListQuery.error.message : "Gagal load data."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(r) => r.id}
            defaultPageSize={10}
            emptyMessage="Belum ada item."
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
                if (sortKey !== "sort_no" && sortKey !== "item_name" && sortKey !== "is_required" && sortKey !== "is_active") return;
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
        moduleLabel="Facility Items"
        action={mode}
        title={mode === "create" ? "Create Facility Item" : "Edit Facility Item"}
        message={
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              Spot: <b>{spotLabelById.get(spotId) ?? "-"}</b>
            </div>

            <TextField label="Item Name" value={form.itemName} onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))} placeholder="Cek APAR" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <TextField
                label="QR Token (opsional)"
                value={form.qrToken}
                onChange={(e) => setForm((p) => ({ ...p, qrToken: e.target.value }))}
                placeholder="Kosongkan untuk auto pakai ID item"
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
            <TextField type="number" min={1} label="Sort No" value={form.sortNo} onChange={(e) => setForm((p) => ({ ...p, sortNo: e.target.value }))} placeholder="1" />

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Required</span>
              <select
                value={String(form.isRequired)}
                onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.value === "true" }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="true">YES</option>
                <option value="false">NO</option>
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
        moduleLabel="Facility Items"
        action="delete"
        title="Delete Facility Item"
        message={
          <div>
            Yakin hapus facility item <b>{selected?.item_name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      {qrViewOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
            <div className="text-base font-semibold text-slate-900">Facility Item QR</div>
            <div className="mt-1 text-sm text-slate-700">
              Item: <b>{qrViewItem?.item_name ?? "-"}</b>
            </div>
            <div className="mt-1 break-all text-xs text-slate-600">Payload: {qrViewItem ? resolveItemQrPayload(qrViewItem) : "-"}</div>

            <div className="mt-4 flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-4">
              {qrImageDataUrl ? (
                <img src={qrImageDataUrl} alt="Facility item QR" className="h-64 w-64" />
              ) : (
                <div className="text-sm text-neutral-500">QR belum tersedia.</div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setQrViewOpen(false)}>
                Close
              </Button>
              <Button onClick={() => (qrViewItem ? void onClickDownloadQr(qrViewItem) : undefined)} disabled={!qrViewItem || qrBusy}>
                Download QR
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Facility Items" variant={feedbackVariant} title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Facility Items" variant={feedbackVariant} title="Error" message={errorText} />
    </>
  );
}
