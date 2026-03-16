"use client";

import * as React from "react";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Role, RoleCreate, RolePatch } from "@/repository/Roles";
import { roleHooks }  from "@/repository/Roles";

type FormState = {
  code: string;
  name: string;
};

type RoleSortColumn = "code" | "name";

const ROLE_SORT_BY_MAP: Record<RoleSortColumn, "code" | "name"> = {
  code: "code",
  name: "name",
};

function toCreatePayload(state: FormState): RoleCreate {
  return { code: state.code.trim(), name: state.name.trim() };
}

function toPatchPayload(state: FormState): RolePatch {
  return { code: state.code.trim(), name: state.name.trim() };
}

export default function RolesPage() {
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: RoleSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "code",
    sortDirection: "asc",
  });

  const list = roleHooks.useList({
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: ROLE_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });
  const createMut = roleHooks.useCreate();
  const updateMut = roleHooks.useUpdate();
  const removeMut = roleHooks.useRemove();

  const rows = React.useMemo(() => (list.data ?? []) as Role[], [list.data]);
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
  const [selected, setSelected] = React.useState<Role | null>(null);

  const [form, setForm] = React.useState<FormState>({ code: "", name: "" });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const onClickCreate = () => {
    setMode("create");
    setSelected(null);
    setForm({ code: "", name: "" });
    setOpenForm(true);
  };

  const onClickEdit = (r: Role) => {
    setMode("edit");
    setSelected(r);
    setForm({ code: r.code ?? "", name: r.name ?? "" });
    setOpenForm(true);
  };

  const onClickDelete = (r: Role) => {
    setSelected(r);
    setConfirmDeleteOpen(true);
  };

  const submit = async () => {
    try {
      if (mode === "create") {
        await createMut.mutateAsync(toCreatePayload(form));
        setSuccessText("Role berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;
        await updateMut.mutateAsync({ id, data: toPatchPayload(form) });
        setSuccessText("Role berhasil diubah.");
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
      setSuccessText("Role berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<Role>[]>(() => {
    return [
      { key: "code", header: "Code", sortable: true, className: "w-[180px]" },
      { key: "name", header: "Name", sortable: true },
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
        title="Roles"
        description="Master role untuk akses aplikasi."
        actions={<Button onClick={onClickCreate}>+ Create</Button>}
      />

      <div className="space-y-3">
        {list.isLoading ? (
          <LoadingStateCard title="Loading roles..." subtitle="Data role sedang dimuat." />
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
            emptyMessage="Belum ada role."
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
                if (sortKey !== "code" && sortKey !== "name") return;
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
        moduleLabel="Roles"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create Role" : "Edit Role"}
        message={
          <div className="mt-4 grid gap-3">
            <TextField
              label="Code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="ADMIN"
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Administrator"
            />
          </div>
        }
        confirmLabel={mode === "create" ? "Create" : "Save"}
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        moduleLabel="Roles"
        action="delete"
        title="Delete Role"
        message={
          <div>
            Yakin hapus role <b>{selected?.name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        moduleLabel="Roles"
        variant={mode === "create" ? "create" : "edit"}
        title="Success"
        message={successText}
      />

      <ErrorModalMaster
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        moduleLabel="Roles"
        variant={mode === "create" ? "create" : "edit"}
        title="Error"
        message={errorText}
      />
    </>
  );
}
