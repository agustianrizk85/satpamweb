"use client";

import * as React from "react";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { User, UserCreate, UserPatch, UserStatus } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { Role } from "@/repository/Roles";
import { roleHooks } from "@/repository/Roles";

const GLOBAL_ROLE_CODES = new Set(["SUPER_ADMIN", "SUPER_USER", "ADMIN"]);

type FormState = {
  roleId: string;
  fullName: string;
  username: string;
  password: string;
  status: UserStatus;
};

type UserSortColumn = "full_name" | "username" | "status";

const USER_SORT_BY_MAP: Record<UserSortColumn, "fullName" | "username" | "status"> = {
  full_name: "fullName",
  username: "username",
  status: "status",
};

function toCreatePayload(state: FormState): UserCreate {
  return {
    roleId: state.roleId,
    fullName: state.fullName.trim(),
    username: state.username.trim(),
    password: state.password,
    status: state.status,
  };
}

function toPatchPayload(state: FormState, includePassword: boolean): UserPatch {
  return {
    roleId: state.roleId,
    fullName: state.fullName.trim(),
    username: state.username.trim(),
    ...(includePassword ? { password: state.password } : {}),
    status: state.status,
  };
}

function readCurrentRoleCode(): string {
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

export default function UsersPage() {
  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: UserSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "full_name",
    sortDirection: "asc",
  });

  const list = userHooks.useList({
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: USER_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });
  const createMut = userHooks.useCreate();
  const updateMut = userHooks.useUpdate();
  const removeMut = userHooks.useRemove();

  const roleList = roleHooks.useList({});
  const [currentRoleCode, setCurrentRoleCode] = React.useState<string>(() => readCurrentRoleCode());

  React.useEffect(() => {
    setCurrentRoleCode(readCurrentRoleCode());
  }, []);

  const roles = React.useMemo(() => (roleList.data ?? []) as Role[], [roleList.data]);
  const createRoles = React.useMemo(() => {
    if (currentRoleCode === "PLACE_ADMIN") {
      return roles.filter((r) => !GLOBAL_ROLE_CODES.has(String(r.code ?? "").toUpperCase()));
    }
    return roles.filter((r) => String(r.code ?? "").toUpperCase() !== "SUPER_ADMIN");
  }, [currentRoleCode, roles]);
  const editableRoles = React.useMemo(() => {
    if (currentRoleCode === "PLACE_ADMIN") return createRoles;
    return roles;
  }, [createRoles, currentRoleCode, roles]);
  const rows = React.useMemo(() => (list.data ?? []) as User[], [list.data]);
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
  const [selected, setSelected] = React.useState<User | null>(null);

  const [form, setForm] = React.useState<FormState>({
    roleId: "",
    fullName: "",
    username: "",
    password: "",
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
    setForm({
      roleId: createRoles[0]?.id ?? "",
      fullName: "",
      username: "",
      password: "",
      status: "ACTIVE",
    });
    setOpenForm(true);
  };

  const onClickEdit = (u: User) => {
    setMode("edit");
    setSelected(u);
    setForm({
      roleId: u.role?.id ?? "",
      fullName: u.full_name ?? "",
      username: u.username ?? "",
      password: "",
      status: u.status ?? "ACTIVE",
    });
    setOpenForm(true);
  };

  const onClickDelete = (u: User) => {
    setSelected(u);
    setConfirmDeleteOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.roleId) {
        setErrorText("Role wajib dipilih.");
        setErrorOpen(true);
        return;
      }

      if (mode === "create") {
        if (!form.password) {
          setErrorText("Password wajib diisi saat create.");
          setErrorOpen(true);
          return;
        }
        await createMut.mutateAsync(toCreatePayload(form));
        setSuccessText("User berhasil dibuat.");
      } else {
        const id = selected?.id;
        if (!id) return;
        const includePassword = Boolean(form.password);
        await updateMut.mutateAsync({ id, data: toPatchPayload(form, includePassword) });
        setSuccessText("User berhasil diubah.");
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
      setSuccessText("User berhasil dihapus.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menghapus data.");
      setErrorOpen(true);
    }
  };

  const columns = React.useMemo<readonly MasterTableColumn<User>[]>(() => {
    return [
      { key: "full_name", header: "Full Name", sortable: true },
      { key: "username", header: "Username", sortable: true, className: "w-[220px]" },
      { key: "role", header: "Role", className: "w-[220px]", render: (r) => r.role?.name ?? "-" },
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
        title="Users"
        description="Master user satpam/admin."
        actions={<Button onClick={onClickCreate}>+ Create</Button>}
      />

      <div className="space-y-3">
        {list.isLoading ? (
          <LoadingStateCard title="Loading users..." subtitle="Data user sedang dimuat." />
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
            emptyMessage="Belum ada user."
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
                if (sortKey !== "full_name" && sortKey !== "username" && sortKey !== "status") return;
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
        moduleLabel="Users"
        action={mode === "create" ? "create" : "edit"}
        title={mode === "create" ? "Create User" : "Edit User"}
        message={
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Role</span>
              <select
                value={form.roleId}
                onChange={(e) => setForm((p) => ({ ...p, roleId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="" disabled>
                  Pilih role
                </option>
                {(mode === "create" ? createRoles : editableRoles).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </label>

            <TextField
              label="Full Name"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Agus"
            />

            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="agus"
            />

            <TextField
              label={mode === "create" ? "Password" : "Password (optional)"}
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="********"
            />

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as UserStatus }))}
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
        moduleLabel="Users"
        action="delete"
        title="Delete User"
        message={
          <div>
            Yakin hapus user <b>{selected?.full_name ?? "-"}</b>?
          </div>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        moduleLabel="Users"
        variant={mode === "create" ? "create" : "edit"}
        title="Success"
        message={successText}
      />

      <ErrorModalMaster
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        moduleLabel="Users"
        variant={mode === "create" ? "create" : "edit"}
        title="Error"
        message={errorText}
      />
    </>
  );
}
