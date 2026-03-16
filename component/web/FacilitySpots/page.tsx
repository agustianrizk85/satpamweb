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
import type { FacilityCheckSpot, FacilityCheckSpotCreate, FacilityCheckSpotPatch } from "@/repository/facility-spots";
import { facilitySpotHooks, listFacilitySpots } from "@/repository/facility-spots";

type FormState = {
  spotCode: string;
  spotName: string;
  isActive: boolean;
};

type FacilitySpotSortColumn = "spot_code" | "spot_name" | "is_active";

const FACILITY_SPOT_SORT_BY_MAP: Record<FacilitySpotSortColumn, "spotCode" | "spotName" | "isActive"> = {
  spot_code: "spotCode",
  spot_name: "spotName",
  is_active: "isActive",
};

function resolveFacilitySpotQrPayload(row: FacilityCheckSpot): string {
  return row.id;
}

function toCreatePayload(placeId: string, s: FormState): FacilityCheckSpotCreate {
  return {
    placeId,
    spotCode: s.spotCode.trim(),
    spotName: s.spotName.trim(),
    isActive: s.isActive,
  };
}

function toPatchPayload(s: FormState): FacilityCheckSpotPatch {
  return {
    spotCode: s.spotCode.trim(),
    spotName: s.spotName.trim(),
    isActive: s.isActive,
  };
}

export default function FacilitySpotsPage() {
  const places = placeHooks.useList({});
  const createMut = facilitySpotHooks.useCreate();
  const updateMut = facilitySpotHooks.useUpdate();
  const removeMut = facilitySpotHooks.useRemove();
  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);

  const [placeId, setPlaceId] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: FacilitySpotSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "spot_code",
    sortDirection: "asc",
  });

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const listQuery = useQuery({
    queryKey: ["satpam-facility-spots", placeId, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listFacilitySpots({
        placeId,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: FACILITY_SPOT_SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: Boolean(placeId.trim()),
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as FacilityCheckSpot[], [listQuery.data]);
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

  const [openForm, setOpenForm] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<FacilityCheckSpot | null>(null);

  const [form, setForm] = React.useState<FormState>({ spotCode: "", spotName: "", isActive: true });

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [feedbackVariant, setFeedbackVariant] = React.useState<"create" | "edit" | "delete">("create");
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [qrViewOpen, setQrViewOpen] = React.useState(false);
  const [qrViewSpot, setQrViewSpot] = React.useState<FacilityCheckSpot | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = React.useState("");
  const [qrBusy, setQrBusy] = React.useState(false);

  const onClickCreate = () => {
    setMode("create");
    setSelected(null);
    setForm({ spotCode: "", spotName: "", isActive: true });
    setOpenForm(true);
  };

  const onClickEdit = React.useCallback((row: FacilityCheckSpot) => {
    setMode("edit");
    setSelected(row);
    setForm({
      spotCode: row.spot_code ?? "",
      spotName: row.spot_name ?? "",
      isActive: row.is_active,
    });
    setOpenForm(true);
  }, []);

  const submit = async () => {
    try {
      if (!placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.spotCode.trim()) throw new Error("Spot code wajib diisi.");
      if (!form.spotName.trim()) throw new Error("Spot name wajib diisi.");

      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(placeId, form));
        setSuccessText("Facility spot berhasil dibuat.");
        setFeedbackVariant("create");
      } else {
        const id = selected?.id;
        if (!id) throw new Error("Facility spot tidak ditemukan.");
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Facility spot berhasil diubah.");
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

  const onClickDelete = React.useCallback((r: FacilityCheckSpot) => {
    setSelected(r);
    setConfirmDeleteOpen(true);
  }, []);

  const confirmDelete = async () => {
    const id = selected?.id;
    if (!id) return;

    try {
      await removeMut.mutateAsync(id);
      setConfirmDeleteOpen(false);
      setFeedbackVariant("delete");
      setSuccessText("Facility spot berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setFeedbackVariant("delete");
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const generateQrImage = React.useCallback(async (row: FacilityCheckSpot): Promise<string> => {
    const payload = resolveFacilitySpotQrPayload(row);
    return QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  }, []);

  const onClickViewQr = React.useCallback(
    async (row: FacilityCheckSpot) => {
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
    async (row: FacilityCheckSpot) => {
      try {
        setQrBusy(true);
        const dataUrl = await generateQrImage(row);
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `facility-spot-${row.id}.png`;
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

  const columns = React.useMemo<readonly MasterTableColumn<FacilityCheckSpot>[]>(() => {
    return [
      { key: "spot_code", header: "Code", sortable: true, className: "w-[200px]" },
      { key: "spot_name", header: "Name", sortable: true },
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
        className: "w-[320px]",
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

  return (
    <>
      <PageHeader
        title="Facility Spots"
        description="Template spot untuk checklist facility per place."
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
        {places.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place facility sedang dimuat." />
        ) : places.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {places.error instanceof Error ? places.error.message : "Gagal load places."}
          </div>
        ) : !placeId.trim() ? (
          <div className="app-glass rounded-[24px] p-4 text-sm text-slate-600 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">Pilih place.</div>
        ) : listQuery.isLoading ? (
          <LoadingStateCard title="Loading facility spots..." subtitle="Titik facility sedang dimuat." />
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
            emptyMessage="Belum ada facility spot."
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
                if (sortKey !== "spot_code" && sortKey !== "spot_name" && sortKey !== "is_active") return;
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
        moduleLabel="Facility Spots"
        action={mode}
        title={mode === "create" ? "Create Facility Spot" : "Edit Facility Spot"}
        message={
          <div className="mt-4 grid gap-3">
            <TextField label="Spot Code" value={form.spotCode} onChange={(e) => setForm((p) => ({ ...p, spotCode: e.target.value }))} placeholder="FSPOT-01" />
            <TextField label="Spot Name" value={form.spotName} onChange={(e) => setForm((p) => ({ ...p, spotName: e.target.value }))} placeholder="Ruang Panel" />
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
        moduleLabel="Facility Spots"
        action="delete"
        title="Delete Facility Spot"
        message={
          <div>
            Yakin hapus facility spot <b>{selected?.spot_name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Facility Spots" variant={feedbackVariant} title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Facility Spots" variant={feedbackVariant} title="Error" message={errorText} />

      {qrViewOpen ? (
        <ConfirmModalMaster
          open={qrViewOpen}
          onClose={() => setQrViewOpen(false)}
          onConfirm={() => setQrViewOpen(false)}
          moduleLabel="Facility Spots"
          action="create"
          title="Facility Spot QR"
          message={
            <div className="mt-4">
              <div className="text-sm text-slate-700">
                Spot: <b>{qrViewSpot?.spot_name ?? "-"}</b>
              </div>
              <div className="mt-1 break-all text-xs text-slate-600">Payload (facility_spot.id): {qrViewSpot ? resolveFacilitySpotQrPayload(qrViewSpot) : "-"}</div>
              <div className="mt-3 flex justify-center">
                {qrImageDataUrl ? (
                  <img src={qrImageDataUrl} alt="Facility Spot QR" className="h-64 w-64" />
                ) : (
                  <div className="text-sm text-slate-500">Generating QR...</div>
                )}
              </div>
            </div>
          }
          confirmLabel="Close"
          cancelLabel="Cancel"
        />
      ) : null}
    </>
  );
}
