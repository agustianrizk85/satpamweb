"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import PageHeader from "@/component/ui/PageHeader";
import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";

import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import type { AttendanceConfig, AttendanceConfigUpsert } from "@/repository/attendance-config";
import { getAttendanceConfig, upsertAttendanceConfig } from "@/repository/attendance-config";

type FormState = {
  placeId: string;
  allowedRadiusM: string;
  centerLatitude: string;
  centerLongitude: string;
  requirePhoto: boolean;
  isActive: boolean;
};

function toNullableNumber(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toUpsertPayload(s: FormState): AttendanceConfigUpsert {
  const radius = Number(s.allowedRadiusM.trim());
  if (!Number.isFinite(radius) || radius <= 0) throw new Error("Allowed radius harus angka > 0.");

  return {
    placeId: s.placeId,
    allowedRadiusM: radius,
    centerLatitude: toNullableNumber(s.centerLatitude),
    centerLongitude: toNullableNumber(s.centerLongitude),
    requirePhoto: s.requirePhoto,
    isActive: s.isActive,
  };
}

export default function AttendanceConfigPage() {
  const qc = useQueryClient();
  const places = placeHooks.useList({});
  const placeRows = React.useMemo(() => (places.data ?? []) as Place[], [places.data]);

  const [placeId, setPlaceId] = React.useState("");

  React.useEffect(() => {
    if (!placeId.trim() && placeRows[0]?.id) setPlaceId(placeRows[0].id);
  }, [placeId, placeRows]);

  const configQuery = useQuery({
    queryKey: ["satpam-attendance-config", placeId],
    queryFn: async () => {
      if (!placeId.trim()) return null;
      return getAttendanceConfig({ placeId });
    },
    enabled: Boolean(placeId.trim()),
  });

  const saveMut = useMutation({
    mutationFn: async (body: AttendanceConfigUpsert) => upsertAttendanceConfig(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-attendance-config", placeId] });
    },
  });

  const [openForm, setOpenForm] = React.useState(false);
  const [form, setForm] = React.useState<FormState>({
    placeId: "",
    allowedRadiusM: "100",
    centerLatitude: "",
    centerLongitude: "",
    requirePhoto: false,
    isActive: true,
  });

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const openEdit = (cfg: AttendanceConfig | null) => {
    const currentPlace = placeId.trim();
    setForm({
      placeId: currentPlace,
      allowedRadiusM: cfg ? String(cfg.allowed_radius_m) : "100",
      centerLatitude: cfg?.center_latitude === null || cfg?.center_latitude === undefined ? "" : String(cfg.center_latitude),
      centerLongitude: cfg?.center_longitude === null || cfg?.center_longitude === undefined ? "" : String(cfg.center_longitude),
      requirePhoto: cfg ? Boolean(cfg.require_photo) : false,
      isActive: cfg ? Boolean(cfg.is_active) : true,
    });
    setOpenForm(true);
  };

  const submit = async () => {
    try {
      if (!form.placeId.trim()) throw new Error("Place wajib dipilih.");
      await saveMut.mutateAsync(toUpsertPayload(form));
      setOpenForm(false);
      setSuccessText("Attendance config berhasil disimpan.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  };

  const placeName = React.useMemo(() => {
    const p = placeRows.find((x) => x.id === placeId);
    return p ? `${p.place_name ?? p.place_code}` : "-";
  }, [placeId, placeRows]);

  return (
    <>
      <PageHeader
        title="Attendance Config"
        description="Pengaturan radius & lokasi absensi per place."
        actions={
          <Button
            onClick={() => openEdit(configQuery.data ?? null)}
            disabled={!placeId.trim() || configQuery.isLoading}
          >
            Edit
          </Button>
        }
      />

      <div className="mb-3 app-glass rounded-[24px] p-3 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-slate-800">Place</span>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
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

      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        <div className="mb-2 text-base font-semibold">{placeName}</div>

        {places.isLoading ? (
          <LoadingStateCard title="Loading places..." subtitle="Daftar place attendance sedang dimuat." />
        ) : places.error ? (
          <div className="text-rose-700">{places.error instanceof Error ? places.error.message : "Gagal load places."}</div>
        ) : configQuery.isLoading ? (
          <LoadingStateCard title="Loading config..." subtitle="Konfigurasi attendance sedang disiapkan." />
        ) : configQuery.error ? (
          <div className="text-rose-700">{configQuery.error instanceof Error ? configQuery.error.message : "Gagal load config."}</div>
        ) : !configQuery.data ? (
          <div className="text-neutral-600">Belum ada config, klik Edit untuk buat.</div>
        ) : (
          <div className="grid gap-2">
            <div>Allowed Radius (m): <b>{configQuery.data.allowed_radius_m}</b></div>
            <div>Center Lat: <b>{configQuery.data.center_latitude ?? "-"}</b></div>
            <div>Center Lng: <b>{configQuery.data.center_longitude ?? "-"}</b></div>
            <div>Require Photo: <b>{configQuery.data.require_photo ? "YES" : "NO"}</b></div>
            <div>Active: <b>{configQuery.data.is_active ? "YES" : "NO"}</b></div>
          </div>
        )}
      </div>

      <ConfirmModalMaster
        open={openForm}
        onClose={() => setOpenForm(false)}
        onConfirm={submit}
        moduleLabel="Attendance Config"
        action="edit"
        title="Edit Attendance Config"
        message={
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              Place: <b>{placeName}</b>
            </div>

            <TextField
              label="Allowed Radius (meter)"
              value={form.allowedRadiusM}
              onChange={(e) => setForm((p) => ({ ...p, allowedRadiusM: e.target.value }))}
              type="number"
              min={1}
              placeholder="100"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Center Latitude"
                value={form.centerLatitude}
                onChange={(e) => setForm((p) => ({ ...p, centerLatitude: e.target.value }))}
                inputMode="decimal"
                placeholder="-6.2"
              />
              <TextField
                label="Center Longitude"
                value={form.centerLongitude}
                onChange={(e) => setForm((p) => ({ ...p, centerLongitude: e.target.value }))}
                inputMode="decimal"
                placeholder="106.8"
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-800">Require Photo</span>
              <select
                value={String(form.requirePhoto)}
                onChange={(e) => setForm((p) => ({ ...p, requirePhoto: e.target.value === "true" }))}
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
        confirmLabel="Save"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Attendance Config" variant="edit" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Attendance Config" variant="edit" title="Error" message={errorText} />
    </>
  );
}
