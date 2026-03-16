"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from "lucide-react";

import Button from "@/component/ui/Button";
import PageHeader from "@/component/ui/PageHeader";
import type { Place } from "@/repository/Places";
import { placeHooks } from "@/repository/Places";
import { auth } from "@/repository";
import type { MeResponse } from "@/repository/auth";
import { listRecentActivities } from "@/repository/recent-activities";
import type { RecentActivityRow, RecentActivitySummary } from "@/repository/recent-activities";

type PlaceOption = {
  id: string;
  label: string;
};

type SummaryCard = {
  title: string;
  value: string;
  description: string;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
};

const EMPTY_SUMMARY: RecentActivitySummary = {
  total_today: 0,
  total_month: 0,
  total_year: 0,
  facility_active: 0,
  spot_active: 0,
  point_active: 0,
  patrol_spot_today: 0,
  patrol_spot_month: 0,
  patrol_spot_year: 0,
  patrol_facility_today: 0,
  patrol_facility_month: 0,
  patrol_facility_year: 0,
  attendance_check_in_today: 0,
  attendance_check_in_month: 0,
  attendance_check_in_year: 0,
  attendance_check_out_today: 0,
  attendance_check_out_month: 0,
  attendance_check_out_year: 0,
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds} detik lalu`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} menit lalu`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} jam lalu`;
  return `${Math.floor(diffSeconds / 86400)} hari lalu`;
}

function getPlaceOptions(me: MeResponse | undefined, places: Place[]): PlaceOption[] {
  const accessRows = me?.placeAccesses ?? [];
  const accessMap = new Map(
    accessRows.map((row) => [row.placeId, `${row.placeName} (${row.placeCode})`] as const),
  );

  if (places.length > 0) {
    if (accessMap.size === 0) {
      return places.map((row) => ({
        id: row.id,
        label: `${row.place_name} (${row.place_code})`,
      }));
    }

    return places
      .filter((row) => accessMap.has(row.id))
      .map((row) => ({
        id: row.id,
        label: `${row.place_name} (${row.place_code})`,
      }));
  }

  return accessRows.map((row) => ({
    id: row.placeId,
    label: `${row.placeName} (${row.placeCode})`,
  }));
}

function activityLabel(row: RecentActivityRow): string {
  switch (row.activity_type) {
    case "PATROL_SPOT_SCAN":
      return "Patrol spot selesai";
    case "PATROL_FACILITY_SCAN":
      return "Facility patrol selesai";
    case "ATTENDANCE_CHECK_IN":
      return "Check-in attendance";
    case "ATTENDANCE_CHECK_OUT":
      return "Check-out attendance";
    default:
      return row.activity_type;
  }
}

export default function DashboardPage() {
  const meQuery = useQuery({
    queryKey: ["satpam-web-dashboard-me"],
    queryFn: () => auth.me(),
  });
  const placesQuery = placeHooks.useList({});

  const me = meQuery.data;
  const placeRows = React.useMemo(() => (placesQuery.data ?? []) as Place[], [placesQuery.data]);
  const placeOptions = React.useMemo(() => getPlaceOptions(me, placeRows), [me, placeRows]);
  const preferredPlaceId = String(me?.defaultPlaceId ?? me?.placeAccesses?.[0]?.placeId ?? "").trim();

  const [selectedPlaceId, setSelectedPlaceId] = React.useState("");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    const optionIds = new Set(placeOptions.map((row) => row.id));
    if (selectedPlaceId && optionIds.has(selectedPlaceId)) return;

    if (preferredPlaceId && optionIds.has(preferredPlaceId)) {
      setSelectedPlaceId(preferredPlaceId);
      return;
    }

    if (placeOptions[0]?.id) {
      setSelectedPlaceId(placeOptions[0].id);
      return;
    }

    if (!selectedPlaceId) return;
    setSelectedPlaceId("");
  }, [placeOptions, preferredPlaceId, selectedPlaceId]);

  const recentActivityQuery = useQuery({
    queryKey: ["satpam-web-dashboard-summary", selectedPlaceId],
    queryFn: () =>
      listRecentActivities({
        placeId: selectedPlaceId || undefined,
        page: 1,
        pageSize: 8,
        sortBy: "activityAt",
        sortOrder: "desc",
      }),
  });

  const summary = recentActivityQuery.data?.summary ?? EMPTY_SUMMARY;
  const recentRows = recentActivityQuery.data?.data ?? [];
  const selectedPlaceLabel =
    placeOptions.find((row) => row.id === selectedPlaceId)?.label ??
    (placeOptions.length > 1 ? "Semua place" : placeOptions[0]?.label ?? "Semua place");

  const accessPlaceCount = placeOptions.length;
  const cards = React.useMemo<SummaryCard[]>(
    () => [
      {
        title: "Total patrol spot hari ini",
        value: formatNumber(summary.patrol_spot_today),
        description: "Jumlah scan patroli spot yang tercatat hari ini.",
        tone: "from-sky-500/20 via-cyan-400/10 to-transparent",
        icon: Activity,
      },
      {
        title: "Total facility hari ini",
        value: formatNumber(summary.patrol_facility_today),
        description: "Jumlah scan facility patrol yang tercatat hari ini.",
        tone: "from-violet-500/18 via-fuchsia-400/10 to-transparent",
        icon: Building2,
      },
      {
        title: "Check-in hari ini",
        value: formatNumber(summary.attendance_check_in_today),
        description: "Jumlah attendance check-in yang masuk hari ini.",
        tone: "from-emerald-500/18 via-teal-400/10 to-transparent",
        icon: CalendarCheck2,
      },
      {
        title: "Check-out hari ini",
        value: formatNumber(summary.attendance_check_out_today),
        description: "Jumlah attendance check-out yang masuk hari ini.",
        tone: "from-amber-500/18 via-orange-400/10 to-transparent",
        icon: CheckCircle2,
      },
    ],
    [summary],
  );

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([meQuery.refetch(), placesQuery.refetch(), recentActivityQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [meQuery, placesQuery, recentActivityQuery]);

  const dataError = meQuery.error ?? placesQuery.error ?? recentActivityQuery.error;
  const isLoading = meQuery.isLoading || placesQuery.isLoading || recentActivityQuery.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard Operasional"
        description="Ringkasan dashboard ini sekarang diambil dari data aktual patroli, facility, dan attendance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {placeOptions.length > 1 ? (
              <select
                value={selectedPlaceId}
                onChange={(e) => setSelectedPlaceId(e.target.value)}
                className="h-10 rounded-xl border border-white/70 bg-white/85 px-3 text-[13px] font-medium text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.08)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
              >
                <option value="">Semua place</option>
                {placeOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            ) : null}
            <Button variant="secondary" onClick={() => void onRefresh()} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
      />

      {dataError ? (
        <div className="rounded-[24px] border border-rose-200/80 bg-rose-50/95 p-4 text-sm text-rose-700 shadow-[0_16px_34px_rgba(244,63,94,0.1)]">
          {dataError instanceof Error ? dataError.message : "Gagal memuat dashboard."}
        </div>
      ) : null}

      <section className="app-glass relative overflow-hidden rounded-[32px] px-6 py-6 shadow-[0_28px_60px_rgba(76,99,168,0.16)] sm:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.18),transparent_24%)]" />
        <div className="relative grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-[0_12px_24px_rgba(14,165,233,0.12)]">
              <ShieldCheck className="h-4 w-4" />
              Live summary
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
              {isLoading ? "Memuat data dashboard..." : "Total operasional tampil dari data yang masuk."}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Place aktif: <span className="font-semibold text-slate-900">{selectedPlaceLabel}</span>. Data di bawah
              mengikuti ringkasan patroli, facility patrol, dan attendance terbaru.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_18px_34px_rgba(15,23,42,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aktivitas hari ini</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatNumber(summary.total_today)}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">Gabungan patroli, facility, dan attendance hari ini.</div>
            </div>
            <div className="rounded-[24px] border border-white/70 bg-slate-900 px-4 py-4 text-white shadow-[0_20px_36px_rgba(15,23,42,0.18)]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <MapPinned className="h-4 w-4" />
                Akses place
              </div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(accessPlaceCount)}</div>
              <div className="mt-2 text-sm leading-6 text-slate-200">Jumlah place yang tersedia untuk dashboard ini.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="app-glass relative overflow-hidden rounded-[28px] p-5 shadow-[0_20px_42px_rgba(76,99,168,0.14)]">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.tone}`} />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.title}</div>
                <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{card.value}</div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="app-glass rounded-[28px] p-5 shadow-[0_20px_42px_rgba(76,99,168,0.14)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Detail summary</div>
          <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Ringkasan total data</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Aktivitas bulan ini</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.total_month)}</div>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Aktivitas tahun ini</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.total_year)}</div>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Point patrol aktif</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.point_active)}</div>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Spot facility aktif</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.spot_active)}</div>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Item facility aktif</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.facility_active)}</div>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Patrol bulan ini</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.patrol_spot_month)}</div>
            </div>
          </div>
        </div>

        <div className="app-glass rounded-[28px] p-5 shadow-[0_20px_42px_rgba(76,99,168,0.14)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(236,72,153,0.16))] text-slate-900">
              <TimerReset className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aktivitas terbaru</div>
              <div className="text-xl font-semibold text-slate-900">Log terakhir dari sistem</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recentRows.length > 0 ? (
              recentRows.map((row) => (
                <div
                  key={row.activity_id}
                  className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activityLabel(row)}</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {row.user_name ?? row.user_id} {" - "} {row.place_name ?? row.place_id}
                      </div>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                      {formatRelativeTime(row.activity_at)}
                    </div>
                  </div>
                  <div className="mt-3 text-xs leading-5 text-slate-600">{formatDateTime(row.activity_at)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 text-sm text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
                Belum ada aktivitas terbaru untuk filter yang dipilih.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
