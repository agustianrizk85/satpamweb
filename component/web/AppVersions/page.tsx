"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import TextField from "@/component/ui/TextField";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type {
  AppVersionMaster,
  AppVersionMasterCreate,
  AppVersionMasterPatch,
} from "@/repository/app-version-masters";
import {
  createAppVersionMaster,
  deleteAppVersionMaster,
  listAppVersionMasters,
  updateAppVersionMaster,
  uploadAppVersionMasterFile,
} from "@/repository/app-version-masters";

const SUPER_ADMIN_ROLE_CODES = new Set(["SUPER_ADMIN", "SUPER_USER"]);

type AppVersionSortColumn = "version_name" | "created_at" | "updated_at" | "is_active" | "is_mandatory";

const SORT_BY_MAP: Record<AppVersionSortColumn, "versionName" | "createdAt" | "updatedAt" | "isActive" | "isMandatory"> = {
  version_name: "versionName",
  created_at: "createdAt",
  updated_at: "updatedAt",
  is_active: "isActive",
  is_mandatory: "isMandatory",
};

type FormState = {
  versionName: string;
  downloadUrl: string;
  isMandatory: boolean;
  isActive: boolean;
  file: File | null;
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

function readRoleFromStorage(): string {
  if (typeof window === "undefined") return "";
  const read = (storage: Storage): string => {
    const raw = storage.getItem("authUser");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as { role?: unknown };
      return typeof parsed.role === "string" ? parsed.role.trim().toUpperCase() : "";
    } catch {
      return "";
    }
  };
  return read(window.localStorage) || read(window.sessionStorage);
}

function toCreatePayload(form: FormState): AppVersionMasterCreate {
  return {
    versionName: form.versionName.trim(),
    downloadUrl: form.downloadUrl.trim(),
    isMandatory: form.isMandatory,
    isActive: form.isActive,
  };
}

function toPatchPayload(form: FormState): AppVersionMasterPatch {
  return {
    versionName: form.versionName.trim(),
    downloadUrl: form.downloadUrl.trim(),
    isMandatory: form.isMandatory,
    isActive: form.isActive,
  };
}

export default function AppVersionsPage() {
  const qc = useQueryClient();
  const [roleCode, setRoleCode] = React.useState<string>("");
  const isSuperAdmin = SUPER_ADMIN_ROLE_CODES.has(roleCode);

  React.useEffect(() => {
    setRoleCode(readRoleFromStorage());
  }, []);

  const [filterIsActive, setFilterIsActive] = React.useState("");
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: AppVersionSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "created_at",
    sortDirection: "desc",
  });

  const listQuery = useQuery({
    queryKey: ["satpam-app-version-masters-page", filterIsActive, tableState.page, tableState.pageSize, tableState.sortKey, tableState.sortDirection],
    queryFn: async () =>
      listAppVersionMasters({
        isActive: filterIsActive === "" ? undefined : filterIsActive === "true",
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortBy: SORT_BY_MAP[tableState.sortKey],
        sortOrder: tableState.sortDirection,
      }),
    enabled: isSuperAdmin,
  });

  const createMut = useMutation({
    mutationFn: async (payload: AppVersionMasterCreate) => createAppVersionMaster(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-app-version-masters-page"] });
    },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AppVersionMasterPatch }) => updateAppVersionMaster(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-app-version-masters-page"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteAppVersionMaster(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-app-version-masters-page"] });
    },
  });

  const rows = React.useMemo(() => (listQuery.data ?? []) as AppVersionMaster[], [listQuery.data]);
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
  const [editing, setEditing] = React.useState<AppVersionMaster | null>(null);
  const [deleting, setDeleting] = React.useState<AppVersionMaster | null>(null);
  const [form, setForm] = React.useState<FormState>({
    versionName: "",
    downloadUrl: "",
    isMandatory: false,
    isActive: true,
    file: null,
  });
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successText, setSuccessText] = React.useState("Berhasil.");
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");

  const openCreateForm = () => {
    setForm({
      versionName: "",
      downloadUrl: "",
      isMandatory: false,
      isActive: true,
      file: null,
    });
    setOpenCreate(true);
  };

  const openEditForm = (row: AppVersionMaster) => {
    setForm({
      versionName: row.version_name,
      downloadUrl: row.download_url,
      isMandatory: row.is_mandatory,
      isActive: row.is_active,
      file: null,
    });
    setEditing(row);
  };

  async function uploadIfNeeded(): Promise<string> {
    if (!form.file) return form.downloadUrl.trim();
    if (!form.versionName.trim()) throw new Error("Version name wajib diisi sebelum upload file.");

    const uploaded = await uploadAppVersionMasterFile({
      versionName: form.versionName.trim(),
      file: form.file,
    });
    return uploaded.downloadUrl;
  }

  const submitCreate = async () => {
    try {
      const downloadUrl = await uploadIfNeeded();
      if (!downloadUrl.trim()) throw new Error("Download URL wajib diisi atau upload file APK.");
      await createMut.mutateAsync(toCreatePayload({ ...form, downloadUrl }));
      setOpenCreate(false);
      setSuccessText("Master version berhasil dibuat.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal membuat master version.");
      setErrorOpen(true);
    }
  };

  const submitUpdate = async () => {
    if (!editing) return;
    try {
      const downloadUrl = await uploadIfNeeded();
      if (!downloadUrl.trim()) throw new Error("Download URL wajib diisi atau upload file APK.");
      await updateMut.mutateAsync({ id: editing.id, data: toPatchPayload({ ...form, downloadUrl }) });
      setEditing(null);
      setSuccessText("Master version berhasil diperbarui.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal memperbarui master version.");
      setErrorOpen(true);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      setDeleting(null);
      setSuccessText("Master version berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus master version.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<AppVersionMaster>[]>(() => [
    { key: "version_name", header: "Version", sortable: true, className: "w-[180px]" },
    {
      key: "download_url",
      header: "Download URL",
      className: "min-w-[320px]",
      render: (row) => (
        <a href={row.download_url} target="_blank" rel="noreferrer" className="text-sky-700 underline underline-offset-2">
          {row.download_url}
        </a>
      ),
    },
    { key: "is_mandatory", header: "Mandatory", sortable: true, className: "w-[110px]", render: (row) => (row.is_mandatory ? "YES" : "NO") },
    { key: "is_active", header: "Active", sortable: true, className: "w-[90px]", render: (row) => (row.is_active ? "YES" : "NO") },
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

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader title="App Versions" description="Master version hanya tersedia untuk super admin." />
        <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/95 p-4 text-sm text-amber-800 shadow-[0_16px_34px_rgba(245,158,11,0.12)]">
          Anda tidak memiliki akses ke modul ini.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="App Versions"
        description="Master versi APK. Ini data master, bukan assignment transaksi per place dan user."
        actions={<Button onClick={openCreateForm}>+ Create Master</Button>}
      />

      <div className="mb-3 grid gap-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)] lg:grid-cols-1">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Filter Active</span>
          <select
            value={filterIsActive}
            onChange={(e) => {
              setFilterIsActive(e.target.value);
              setTableState((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          >
            <option value="">Semua</option>
            <option value="true">ACTIVE</option>
            <option value="false">INACTIVE</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {listQuery.isLoading ? (
          <LoadingStateCard title="Loading app version masters..." subtitle="Memuat data master versi APK." />
        ) : listQuery.error ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {listQuery.error instanceof Error ? listQuery.error.message : "Gagal load app version masters."}
          </div>
        ) : (
          <MasterTable
            columns={columns}
            data={rows}
            getRowKey={(row) => row.id}
            defaultPageSize={10}
            emptyMessage="Belum ada master version."
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
                  sortKey !== "version_name"
                  && sortKey !== "created_at"
                  && sortKey !== "updated_at"
                  && sortKey !== "is_active"
                  && sortKey !== "is_mandatory"
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
        moduleLabel="App Versions"
        action="create"
        title="Create App Version Master"
        message={
          <div className="mt-4 grid gap-3">
            <TextField label="Version Name" value={form.versionName} onChange={(e) => setForm((prev) => ({ ...prev, versionName: e.target.value }))} placeholder="contoh: 1.0.7" />
            <TextField label="Download URL" value={form.downloadUrl} onChange={(e) => setForm((prev) => ({ ...prev, downloadUrl: e.target.value }))} placeholder="Boleh kosong jika upload APK" />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Upload APK</span>
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm((prev) => ({ ...prev, isMandatory: e.target.checked }))} />
              Mandatory update
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              Active
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
        moduleLabel="App Versions"
        action="edit"
        title="Edit App Version Master"
        message={
          <div className="mt-4 grid gap-3">
            <TextField label="Version Name" value={form.versionName} onChange={(e) => setForm((prev) => ({ ...prev, versionName: e.target.value }))} />
            <TextField label="Download URL" value={form.downloadUrl} onChange={(e) => setForm((prev) => ({ ...prev, downloadUrl: e.target.value }))} />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Ganti File APK</span>
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm((prev) => ({ ...prev, isMandatory: e.target.checked }))} />
              Mandatory update
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              Active
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
        moduleLabel="App Versions"
        action="delete"
        title="Delete App Version Master"
        message={
          <div className="space-y-2 text-sm text-slate-700">
            <div>Master version ini akan dihapus.</div>
            <div className="font-semibold">
              {deleting ? deleting.version_name : ""}
            </div>
          </div>
        }
        confirmLabel={deleteMut.isPending ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="App Versions" variant="create" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="App Versions" variant="create" title="Error" message={errorText} />
    </>
  );
}
