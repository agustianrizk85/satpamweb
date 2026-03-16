"use client";

import * as React from "react";
import PageHeader from "@/component/ui/PageHeader";
import MasterTable, { type MasterTableColumn } from "@/component/ui/MasterTable";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";
import { readListMeta } from "@/libs/list-meta";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { Role } from "@/repository/Roles";
import { roleHooks } from "@/repository/Roles";
import type { User } from "@/repository/Users";
import { userHooks } from "@/repository/Users";
import type { UserPlaceRole, UserPlaceRoleUpsert } from "@/repository/Place_Admins";
import { userPlaceRoleHooks } from "@/repository/Place_Admins";

type FormState = {
  userId: string;
  placeId: string;
  roleId: string;
  isActive: boolean;
};

type PlaceAdminSortColumn = "user_id" | "place_id" | "role_id" | "is_active";

const PLACE_ADMIN_SORT_BY_MAP: Record<PlaceAdminSortColumn, "userId" | "placeId" | "roleId" | "isActive"> = {
  user_id: "userId",
  place_id: "placeId",
  role_id: "roleId",
  is_active: "isActive",
};

const GLOBAL_ROLE_CODES = new Set(["SUPER_ADMIN", "SUPER_USER", "ADMIN"]);

function toUpsertPayload(state: FormState): UserPlaceRoleUpsert {
  return {
    userId: state.userId,
    placeId: state.placeId,
    roleId: state.roleId,
    isActive: state.isActive,
  };
}

export default function PlaceAdminsPage() {
  const places = placeHooks.useList({});
  const roles = roleHooks.useList({});
  const users = userHooks.useList({});

  const [tableState, setTableState] = React.useState<{
    page: number;
    pageSize: number;
    sortKey: PlaceAdminSortColumn;
    sortDirection: "asc" | "desc";
  }>({
    page: 1,
    pageSize: 10,
    sortKey: "user_id",
    sortDirection: "asc",
  });

  const list = userPlaceRoleHooks.useList({
    page: tableState.page,
    pageSize: tableState.pageSize,
    sortBy: PLACE_ADMIN_SORT_BY_MAP[tableState.sortKey],
    sortOrder: tableState.sortDirection,
  });
  const upsertMut = userPlaceRoleHooks.useCreate();

  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);
  const roleRows = React.useMemo(() => (roles.data ?? []) as Role[], [roles.data]);
  const assignableRoleRows = React.useMemo(
    () => roleRows.filter((r) => !GLOBAL_ROLE_CODES.has((r.code ?? "").toUpperCase())),
    [roleRows],
  );
  const userRows = React.useMemo(() => (users.data ?? []) as User[], [users.data]);
  const rows = React.useMemo(() => (list.data ?? []) as UserPlaceRole[], [list.data]);
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
    const m = new Map<string, string>();
    for (const p of placeRows) m.set(p.id, p.place_name ?? p.place_code ?? p.id);
    return m;
  }, [placeRows]);

  const roleNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of roleRows) m.set(r.id, r.name ?? r.code ?? r.id);
    return m;
  }, [roleRows]);

  const userNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const u of userRows) m.set(u.id, u.full_name ?? u.username ?? u.id);
    return m;
  }, [userRows]);

  const [openForm, setOpenForm] = React.useState(false);
  const [selected, setSelected] = React.useState<UserPlaceRole | null>(null);

  const [form, setForm] = React.useState<FormState>({
    userId: "",
    placeId: "",
    roleId: "",
    isActive: true,
  });

  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const onClickCreate = () => {
    setSelected(null);
    setForm({
      userId: userRows[0]?.id ?? "",
      placeId: placeRows[0]?.id ?? "",
      roleId: assignableRoleRows[0]?.id ?? "",
      isActive: true,
    });
    setOpenForm(true);
  };

  const onClickEdit = (r: UserPlaceRole) => {
    const allowedCurrentRole = assignableRoleRows.some((role) => role.id === r.role_id);
    setSelected(r);
    setForm({
      userId: r.user_id ?? "",
      placeId: r.place_id ?? "",
      roleId: allowedCurrentRole ? r.role_id ?? "" : assignableRoleRows[0]?.id ?? "",
      isActive: Boolean(r.is_active),
    });
    setOpenForm(true);
  };

  const onClickDeactivate = (r: UserPlaceRole) => {
    setSelected(r);
    setConfirmDeactivateOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.userId.trim()) throw new Error("User wajib dipilih.");
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      if (!form.roleId.trim()) throw new Error("Role wajib dipilih.");

      await upsertMut.mutateAsync(toUpsertPayload(form));
      setOpenForm(false);
      setSuccessText("Relasi user-place-role berhasil disimpan.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const confirmDeactivate = async () => {
    const r = selected;
    if (!r) return;

    try {
      const payload: UserPlaceRoleUpsert = {
        userId: r.user_id,
        placeId: r.place_id,
        roleId: r.role_id,
        isActive: false,
      };
      await upsertMut.mutateAsync(payload);
      setConfirmDeactivateOpen(false);
      setSuccessText("Relasi berhasil dinonaktifkan.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menonaktifkan data.");
      setErrorOpen(true);
    }
  };

  const columns: readonly MasterTableColumn<UserPlaceRole>[] = [
    {
      key: "user_id",
      header: "User",
      sortable: true,
      render: (r) => userNameById.get(r.user_id) ?? r.user_id,
    },
    {
      key: "place_id",
      header: "Place",
      sortable: true,
      render: (r) => placeNameById.get(r.place_id) ?? r.place_id,
    },
    {
      key: "role_id",
      header: "Role",
      sortable: true,
      render: (r) => roleNameById.get(r.role_id) ?? r.role_id,
    },
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
      className: "w-[260px]",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => onClickEdit(r)}>
            Edit
          </Button>
          <Button variant="secondary" onClick={() => onClickDeactivate(r)}>
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  const anyLoading = places.isLoading || roles.isLoading || users.isLoading;
  const anyError = places.error ?? roles.error ?? users.error;

  return (
    <>
      <PageHeader title="Place Admins" description="Relasi user-place-role (upsert)." actions={<Button onClick={onClickCreate}>+ Create</Button>} />

      <div className="space-y-3">
        {anyLoading ? (
          <LoadingStateCard title="Loading master data..." subtitle="User, place, dan role sedang dimuat." />
        ) : anyError ? (
          <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
            {anyError instanceof Error ? anyError.message : "Gagal load master data."}
          </div>
        ) : list.isLoading ? (
          <LoadingStateCard title="Loading place admins..." subtitle="Relasi akses place sedang dimuat." />
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
            emptyMessage="Belum ada relasi."
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
                if (sortKey !== "user_id" && sortKey !== "place_id" && sortKey !== "role_id" && sortKey !== "is_active") return;
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
        moduleLabel="Place Admins"
        action={selected ? "edit" : "create"}
        title={selected ? "Edit User-Place-Role" : "Create User-Place-Role"}
        message={
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">User</span>
              <select
                value={form.userId}
                onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih user</option>
                {userRows.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            </label>

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

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Role</span>
              <select
                value={form.roleId}
                onChange={(e) => setForm((p) => ({ ...p, roleId: e.target.value }))}
                className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Pilih role</option>
                {assignableRoleRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
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
        confirmLabel="Save"
        cancelLabel="Cancel"
      />

      <ConfirmModalMaster
        open={confirmDeactivateOpen}
        onClose={() => setConfirmDeactivateOpen(false)}
        onConfirm={confirmDeactivate}
        moduleLabel="Place Admins"
        action="delete"
        title="Deactivate Relation"
        message={
          <div>
            Nonaktifkan relasi <b>{userNameById.get(selected?.user_id ?? "") ?? "-"}</b> di{" "}
            <b>{placeNameById.get(selected?.place_id ?? "") ?? "-"}</b>?
          </div>
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Place Admins" variant="edit" title="Success" message={successText} />

      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Place Admins" variant="edit" title="Error" message={errorText} />
    </>
  );
}
