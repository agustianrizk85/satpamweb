"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/component/ui/Button";
import LoadingStateCard from "@/component/ui/LoadingStateCard";
import PageHeader from "@/component/ui/PageHeader";
import TextField from "@/component/ui/TextField";
import { ConfirmModalMaster, ErrorModalMaster, SuccessModalMaster } from "@/component/ui/layout/ModalMaster";

import type { TokenConfigUpsert } from "@/repository/token-config/model";
import { getTokenConfig, upsertTokenConfig } from "@/repository/token-config/services";

type TTLUnit = "seconds" | "minutes" | "hours" | "days";

type FormState = {
  accessValue: string;
  accessUnit: TTLUnit;
  refreshValue: string;
  refreshUnit: TTLUnit;
};

const UNIT_SECONDS: Record<TTLUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

function splitDuration(totalSeconds: number): { value: string; unit: TTLUnit } {
  if (totalSeconds % UNIT_SECONDS.days === 0) return { value: String(totalSeconds / UNIT_SECONDS.days), unit: "days" };
  if (totalSeconds % UNIT_SECONDS.hours === 0) return { value: String(totalSeconds / UNIT_SECONDS.hours), unit: "hours" };
  if (totalSeconds % UNIT_SECONDS.minutes === 0) return { value: String(totalSeconds / UNIT_SECONDS.minutes), unit: "minutes" };
  return { value: String(totalSeconds), unit: "seconds" };
}

function formatDuration(totalSeconds: number): string {
  const { value, unit } = splitDuration(totalSeconds);
  const labels: Record<TTLUnit, string> = {
    seconds: "detik",
    minutes: "menit",
    hours: "jam",
    days: "hari",
  };
  return `${value} ${labels[unit]}`;
}

function toSeconds(value: string, unit: TTLUnit, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} harus angka >= 1.`);
  }
  return Math.floor(parsed) * UNIT_SECONDS[unit];
}

function toPayload(form: FormState): TokenConfigUpsert {
  return {
    accessTtlSeconds: toSeconds(form.accessValue, form.accessUnit, "Access token TTL"),
    refreshTtlSeconds: toSeconds(form.refreshValue, form.refreshUnit, "Refresh token TTL"),
  };
}

export default function TokenConfigPage() {
  const qc = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["satpam-token-config"],
    queryFn: () => getTokenConfig(),
  });

  const saveMut = useMutation({
    mutationFn: async (body: TokenConfigUpsert) => upsertTokenConfig(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["satpam-token-config"] });
    },
  });

  const [openForm, setOpenForm] = React.useState(false);
  const [form, setForm] = React.useState<FormState>({
    accessValue: "8",
    accessUnit: "hours",
    refreshValue: "30",
    refreshUnit: "days",
  });
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorText, setErrorText] = React.useState("Terjadi kesalahan.");
  const [successText, setSuccessText] = React.useState("Berhasil.");

  const openEdit = React.useCallback(() => {
    const cfg = configQuery.data;
    if (cfg) {
      const access = splitDuration(cfg.access_ttl_seconds);
      const refresh = splitDuration(cfg.refresh_ttl_seconds);
      setForm({
        accessValue: access.value,
        accessUnit: access.unit,
        refreshValue: refresh.value,
        refreshUnit: refresh.unit,
      });
    }
    setOpenForm(true);
  }, [configQuery.data]);

  const submit = React.useCallback(async () => {
    try {
      const payload = toPayload(form);
      await saveMut.mutateAsync(payload);
      setOpenForm(false);
      setSuccessText("Token config berhasil disimpan.");
      setSuccessOpen(true);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal menyimpan data.");
      setErrorOpen(true);
    }
  }, [form, saveMut]);

  return (
    <>
      <PageHeader
        title="Token Config"
        description="Atur masa berlaku access token dan refresh token untuk kebutuhan testing."
        actions={
          <Button onClick={openEdit} disabled={configQuery.isLoading}>
            Edit
          </Button>
        }
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        {configQuery.isLoading ? (
          <LoadingStateCard title="Loading config..." subtitle="Konfigurasi token sedang disiapkan." />
        ) : configQuery.error ? (
          <div className="text-rose-700">{configQuery.error instanceof Error ? configQuery.error.message : "Gagal load token config."}</div>
        ) : !configQuery.data ? (
          <div className="text-neutral-600">Belum ada config token.</div>
        ) : (
          <div className="grid gap-2">
            <div>Access Token TTL: <b>{formatDuration(configQuery.data.access_ttl_seconds)}</b></div>
            <div>Refresh Token TTL: <b>{formatDuration(configQuery.data.refresh_ttl_seconds)}</b></div>
            <div>Updated At: <b>{new Date(configQuery.data.updated_at).toLocaleString("id-ID")}</b></div>
          </div>
        )}
      </div>

      <ConfirmModalMaster
        open={openForm}
        onClose={() => setOpenForm(false)}
        onConfirm={submit}
        moduleLabel="Token Config"
        action="edit"
        title="Edit Token Config"
        message={
          <div className="mt-4 grid gap-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Untuk testing, kamu bisa isi contoh seperti <b>20 detik</b> atau <b>6 hari</b>.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Access Token"
                value={form.accessValue}
                onChange={(e) => setForm((prev) => ({ ...prev, accessValue: e.target.value }))}
                type="number"
                min={1}
                placeholder="20"
              />
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-slate-800">Unit</span>
                <select
                  value={form.accessUnit}
                  onChange={(e) => setForm((prev) => ({ ...prev, accessUnit: e.target.value as TTLUnit }))}
                  className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
                >
                  <option value="seconds">Detik</option>
                  <option value="minutes">Menit</option>
                  <option value="hours">Jam</option>
                  <option value="days">Hari</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Refresh Token"
                value={form.refreshValue}
                onChange={(e) => setForm((prev) => ({ ...prev, refreshValue: e.target.value }))}
                type="number"
                min={1}
                placeholder="6"
              />
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-slate-800">Unit</span>
                <select
                  value={form.refreshUnit}
                  onChange={(e) => setForm((prev) => ({ ...prev, refreshUnit: e.target.value as TTLUnit }))}
                  className="w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
                >
                  <option value="seconds">Detik</option>
                  <option value="minutes">Menit</option>
                  <option value="hours">Jam</option>
                  <option value="days">Hari</option>
                </select>
              </label>
            </div>
          </div>
        }
        confirmLabel="Save"
        cancelLabel="Cancel"
      />

      <SuccessModalMaster open={successOpen} onClose={() => setSuccessOpen(false)} moduleLabel="Token Config" variant="edit" title="Success" message={successText} />
      <ErrorModalMaster open={errorOpen} onClose={() => setErrorOpen(false)} moduleLabel="Token Config" variant="edit" title="Error" message={errorText} />
    </>
  );
}
