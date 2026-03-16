"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/repository";
import type { FacilityCheckItem } from "@/repository/facility-items";
import { listFacilityItems } from "@/repository/facility-items";
import type { FacilityCheckSpot } from "@/repository/facility-spots";
import { listFacilitySpots } from "@/repository/facility-spots";
import type { Shift } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";
import type { Spot } from "@/repository/Spots";
import { spotHooks } from "@/repository/Spots";
import type { SpotAssignment } from "@/repository/spot-assignments";
import { spotAssignmentHooks } from "@/repository/spot-assignments";
import { listRecentActivities } from "@/repository/recent-activities";
import MobileWebShell from "@/component/mobile/MobileWebShell";

type DetailType = "patrol-active" | "patrol-today" | "facility-today" | "spot-active" | "facility-item-active";

type FacilityActiveItemRow = {
  item_id: string;
  item_name: string;
  sort_no: number;
  spot_id: string;
  spot_name: string;
  spot_code: string;
};

function isDetailType(v: string | null): v is DetailType {
  return (
    v === "patrol-active" ||
    v === "patrol-today" ||
    v === "facility-today" ||
    v === "spot-active" ||
    v === "facility-item-active"
  );
}

function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactId(v: string | null | undefined): string {
  if (!v) return "-";
  if (v.length <= 18) return v;
  return `${v.slice(0, 8)}...${v.slice(-4)}`;
}

function getMetaText(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!meta) return null;
  const value = meta[key];
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function getHeader(type: DetailType): { title: string; subtitle: string } {
  if (type === "patrol-active") {
    return { title: "Detail Spot Patroli Aktif", subtitle: "Assignment patroli aktif untuk user login" };
  }
  if (type === "patrol-today") {
    return { title: "Detail Patroli Spot Hari Ini", subtitle: "Daftar scan patroli spot hari ini" };
  }
  if (type === "facility-today") {
    return { title: "Detail Facility Hari Ini", subtitle: "Daftar scan facility hari ini" };
  }
  if (type === "facility-item-active") {
    return { title: "Detail Item Facility Aktif", subtitle: "Daftar item facility aktif per spot" };
  }
  return { title: "Detail Spot Aktif", subtitle: "Master spot aktif di place saat ini" };
}

export default function SummaryDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayKey = React.useMemo(() => localDateKey(new Date()), []);

  const typeParam = searchParams.get("type");
  const detailType = isDetailType(typeParam) ? typeParam : null;

  const meQuery = useQuery({
    queryKey: ["satpam-mobile-me-summary-detail"],
    queryFn: () => auth.me(),
  });
  const me = meQuery.data ?? null;
  const activePlaceId = me?.defaultPlaceId ?? me?.placeAccesses?.[0]?.placeId ?? "";
  const activePlaceName =
    me?.placeAccesses?.find((a) => a.placeId === activePlaceId)?.placeName ??
    me?.placeAccesses?.[0]?.placeName ??
    "-";

  const assignmentQuery = spotAssignmentHooks.useList(
    {
      placeId: activePlaceId || undefined,
      userId: me?.id,
      isActive: true,
      page: 1,
      pageSize: 20,
      sortBy: "updatedAt",
      sortOrder: "desc",
    },
    { enabled: Boolean(detailType === "patrol-active" && activePlaceId && me?.id) },
  );

  const shiftQuery = shiftHooks.useList(
    { placeId: activePlaceId || undefined, page: 1, pageSize: 100 },
    { enabled: Boolean(detailType === "patrol-active" && activePlaceId) },
  );

  const spotQuery = spotHooks.useList(
    {
      placeId: activePlaceId || undefined,
      status: "ACTIVE",
      page: 1,
      pageSize: 100,
      sortBy: "spotCode",
      sortOrder: "asc",
    },
    { enabled: Boolean(detailType === "spot-active" && activePlaceId) },
  );

  const isRecentType = detailType === "patrol-today" || detailType === "facility-today";
  const activityType = detailType === "patrol-today" ? "PATROL_SPOT_SCAN" : "PATROL_FACILITY_SCAN";

  const recentQuery = useQuery({
    queryKey: ["satpam-mobile-summary-detail-recent", detailType, activePlaceId, me?.id, todayKey],
    enabled: Boolean(isRecentType && activePlaceId && me?.id),
    queryFn: () =>
      listRecentActivities({
        placeId: activePlaceId,
        userId: me?.id,
        activityType,
        fromDate: todayKey,
        toDate: todayKey,
        page: 1,
        pageSize: 100,
        sortBy: "activityAt",
        sortOrder: "desc",
      }),
  });

  const facilityItemActiveQuery = useQuery({
    queryKey: ["satpam-mobile-summary-detail-facility-item-active", activePlaceId],
    enabled: Boolean(detailType === "facility-item-active" && activePlaceId),
    queryFn: async () => {
      const spots = (await listFacilitySpots({
        placeId: activePlaceId,
        page: 1,
        pageSize: 100,
        sortBy: "spotCode",
        sortOrder: "asc",
      })) as FacilityCheckSpot[];

      const activeFacilitySpots = spots.filter((spot) => spot.is_active);
      const rows = await Promise.all(
        activeFacilitySpots.map(async (spot) => {
          const items = (await listFacilityItems({
            spotId: spot.id,
            page: 1,
            pageSize: 100,
            sortBy: "sortNo",
            sortOrder: "asc",
          })) as FacilityCheckItem[];

          return items
            .filter((item) => item.is_active)
            .map<FacilityActiveItemRow>((item) => ({
              item_id: item.id,
              item_name: item.item_name,
              sort_no: item.sort_no,
              spot_id: spot.id,
              spot_name: spot.spot_name,
              spot_code: spot.spot_code,
            }));
        }),
      );

      return rows.flat();
    },
  });

  const assignmentRows = React.useMemo(() => (assignmentQuery.data ?? []) as SpotAssignment[], [assignmentQuery.data]);
  const shiftRows = React.useMemo(() => (shiftQuery.data ?? []) as Shift[], [shiftQuery.data]);
  const activeSpots = React.useMemo(() => (spotQuery.data ?? []) as Spot[], [spotQuery.data]);
  const recentRows = React.useMemo(() => recentQuery.data?.data ?? [], [recentQuery.data]);
  const activeFacilityItems = React.useMemo(
    () => facilityItemActiveQuery.data ?? [],
    [facilityItemActiveQuery.data],
  );

  const shiftById = React.useMemo(() => {
    const map = new Map<string, Shift>();
    for (const shift of shiftRows) map.set(shift.id, shift);
    return map;
  }, [shiftRows]);

  const header = detailType ? getHeader(detailType) : { title: "Detail", subtitle: "Parameter type tidak valid" };

  const dataError =
    meQuery.error ??
    (detailType === "patrol-active" ? assignmentQuery.error ?? shiftQuery.error : null) ??
    (detailType === "spot-active" ? spotQuery.error : null) ??
    (detailType === "facility-item-active" ? facilityItemActiveQuery.error : null) ??
    (isRecentType ? recentQuery.error : null);

  const dataLoading =
    meQuery.isLoading ||
    (detailType === "patrol-active" && (assignmentQuery.isLoading || shiftQuery.isLoading)) ||
    (detailType === "spot-active" && spotQuery.isLoading) ||
    (detailType === "facility-item-active" && facilityItemActiveQuery.isLoading) ||
    (isRecentType && recentQuery.isLoading);

  return (
    <MobileWebShell contentClassName="bg-[#f3f6fb]">
    <div className="min-h-full bg-[#f3f6fb] pb-8">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[430px] items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.push("/mobile/dashboard")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-black text-slate-900">{header.title}</div>
            <div className="truncate text-[11px] font-bold text-slate-500">{activePlaceName}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] px-4 pt-4">
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600">
          {header.subtitle}
        </div>

        {!detailType ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold text-amber-800">
            Parameter detail tidak valid.
          </div>
        ) : null}

        {dataError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-bold text-rose-700">
            {dataError instanceof Error ? dataError.message : "Gagal memuat detail."}
          </div>
        ) : null}

        {dataLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-bold text-slate-600">Memuat detail...</div>
        ) : null}

        {detailType === "patrol-active" && !dataLoading ? (
          <div className="space-y-2">
            {assignmentRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-bold text-slate-500">
                Tidak ada assignment patroli aktif.
              </div>
            ) : (
              assignmentRows.map((row) => {
                const shift = shiftById.get(row.shift_id);
                return (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[13px] font-black text-slate-900">Assignment Aktif</div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-600">
                      Shift: {shift ? `${shift.name} (${shift.start_time}-${shift.end_time})` : compactId(row.shift_id)}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-600">Mulai: {formatDateTime(row.created_at)}</div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {(detailType === "patrol-today" || detailType === "facility-today") && !dataLoading ? (
          <div className="space-y-2">
            {recentRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-bold text-slate-500">
                Belum ada data untuk hari ini.
              </div>
            ) : (
              recentRows.map((row) => {
                const spotId = getMetaText(row.metadata, "spotId");
                const patrolRunId = getMetaText(row.metadata, "patrolRunId");
                const status = getMetaText(row.metadata, "status");
                return (
                  <div key={row.activity_id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[13px] font-black text-slate-900">
                      {detailType === "patrol-today" ? "Patroli Spot" : "Facility Patrol"}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-600">Waktu: {formatDateTime(row.activity_at)}</div>
                    {spotId ? <div className="mt-1 text-[11px] font-semibold text-slate-600">Spot: {compactId(spotId)}</div> : null}
                    {patrolRunId ? <div className="mt-1 text-[11px] font-semibold text-slate-600">Run: {compactId(patrolRunId)}</div> : null}
                    {status ? <div className="mt-1 text-[11px] font-semibold text-slate-600">Status: {status}</div> : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {detailType === "spot-active" && !dataLoading ? (
          <div className="space-y-2">
            {activeSpots.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-bold text-slate-500">
                Tidak ada spot aktif.
              </div>
            ) : (
              activeSpots.map((spot) => (
                <div key={spot.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[13px] font-black text-slate-900">{spot.spot_name ?? spot.name ?? compactId(spot.id)}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-600">Kode: {spot.spot_code ?? spot.code ?? "-"}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-600">ID: {compactId(spot.id)}</div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {detailType === "facility-item-active" && !dataLoading ? (
          <div className="space-y-2">
            {activeFacilityItems.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-bold text-slate-500">
                Tidak ada item facility aktif.
              </div>
            ) : (
              activeFacilityItems.map((item) => (
                <div key={item.item_id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[13px] font-black text-slate-900">{item.item_name}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-600">
                    Spot: {item.spot_name} ({item.spot_code})
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-600">Urutan: {item.sort_no}</div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
    </MobileWebShell>
  );
}
