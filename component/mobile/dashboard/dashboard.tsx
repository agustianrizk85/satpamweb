"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  MapPinned,
  QrCode,
  User,
  WifiOff,
} from "lucide-react";
import { auth } from "@/repository";
import type { Shift } from "@/repository/Shifts";
import { shiftHooks } from "@/repository/Shifts";
import type { SpotAssignment } from "@/repository/spot-assignments";
import { spotAssignmentHooks } from "@/repository/spot-assignments";
import type { Attendance } from "@/repository/attendances";
import { attendanceHooks } from "@/repository/attendances";
import type { RecentActivitySummary } from "@/repository/recent-activities";
import { listRecentActivities } from "@/repository/recent-activities";
import MobileWebShell from "@/component/mobile/MobileWebShell";

type AttendanceLike = {
  check_in_at?: string | null;
  check_out_at?: string | null;
  status?: string | null;
};

type AssignmentLike = {
  user_name: string;
  place_name: string;
  shift_name: string;
  start_date: string | null;
  end_date: string | null;
};

type RecentLogLike = {
  id: string;
  title: string;
  subtitle: string;
};

const EMPTY_ACTIVITY_SUMMARY: RecentActivitySummary = {
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

function getMetaText(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!meta) return null;
  const value = meta[key];
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "-";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "-";
  const startLabel = startDate.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (!end) return `${startLabel} - Sekarang`;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${startLabel} - Sekarang`;
  const endLabel = endDate.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

function attendanceLabel(attendance: AttendanceLike | null): string {
  if (!attendance) return "Belum Absen";
  if (attendance.check_in_at && !attendance.check_out_at) return "Absen Masuk";
  if (attendance.check_in_at && attendance.check_out_at) return "Absen Keluar";
  if (!attendance.status) return "Belum Absen";
  return attendance.status.toUpperCase() === "PRESENT" ? "Hadir" : attendance.status;
}

function attendanceTone(attendance: AttendanceLike | null): { bg: string; text: string; border: string } {
  if (!attendance) return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" };
  if (attendance.check_in_at && !attendance.check_out_at) return { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" };
  if (attendance.check_in_at && attendance.check_out_at) return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  if (attendance.status?.toUpperCase() === "PRESENT") return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  return { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" };
}

function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec} detik lalu`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return `${Math.floor(diffSec / 86400)} hari lalu`;
}

export default function DashboardPage() {
  const router = useRouter();
  const todayKey = React.useMemo(() => localDateKey(new Date()), []);

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = React.useState(false);
  const [isStartingPatrol, setIsStartingPatrol] = React.useState(false);
  const [isStartingFacilityPatrol, setIsStartingFacilityPatrol] = React.useState(false);
  const [patrolError, setPatrolError] = React.useState<string | null>(null);
  const [facilityPatrolError, setFacilityPatrolError] = React.useState<string | null>(null);
  const [isRecentCollapsed, setIsRecentCollapsed] = React.useState(false);

  const [selectedShiftId, setSelectedShiftId] = React.useState("");
  const [isAssigningShift, setIsAssigningShift] = React.useState(false);
  const [shiftSetupError, setShiftSetupError] = React.useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["satpam-mobile-me"],
    queryFn: () => auth.me(),
  });

  const me = meQuery.data ?? null;
  const activePlaceId = me?.defaultPlaceId ?? me?.placeAccesses?.[0]?.placeId ?? "";
  const activePlaceAccess =
    me?.placeAccesses?.find((access) => access.placeId === activePlaceId) ?? me?.placeAccesses?.[0] ?? null;

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
    { enabled: Boolean(activePlaceId && me?.id), refetchOnMount: "always" },
  );
  const createAssignmentMut = spotAssignmentHooks.useCreate();
  const shiftQuery = shiftHooks.useList(
    { placeId: activePlaceId || undefined, page: 1, pageSize: 100 },
    { enabled: Boolean(activePlaceId) },
  );
  const attendanceQuery = attendanceHooks.useList(
    { placeId: activePlaceId || undefined, userId: me?.id, attendanceDate: todayKey, page: 1, pageSize: 5 },
    { enabled: Boolean(activePlaceId && me?.id) },
  );
  const recentActivityQuery = useQuery({
    queryKey: ["satpam-mobile-recent-activities", activePlaceId, me?.id],
    enabled: Boolean(activePlaceId && me?.id),
    queryFn: () =>
      listRecentActivities({
        placeId: activePlaceId,
        userId: me?.id,
        page: 1,
        pageSize: 20,
        sortBy: "activityAt",
        sortOrder: "desc",
      }),
  });

  const assignmentRows = React.useMemo(() => (assignmentQuery.data ?? []) as SpotAssignment[], [assignmentQuery.data]);
  const shiftRows = React.useMemo(() => (shiftQuery.data ?? []) as Shift[], [shiftQuery.data]);
  const attendanceRows = React.useMemo(() => (attendanceQuery.data ?? []) as Attendance[], [attendanceQuery.data]);
  const recentActivityRows = React.useMemo(
    () => recentActivityQuery.data?.data ?? [],
    [recentActivityQuery.data],
  );
  const recentActivitySummary = React.useMemo(
    () => recentActivityQuery.data?.summary ?? EMPTY_ACTIVITY_SUMMARY,
    [recentActivityQuery.data],
  );

  const shiftById = React.useMemo(() => {
    const m = new Map<string, Shift>();
    for (const s of shiftRows) m.set(s.id, s);
    return m;
  }, [shiftRows]);

  const myActiveAssignment = React.useMemo(
    () => assignmentRows.find((row) => row.user_id === me?.id && row.is_active) ?? null,
    [assignmentRows, me?.id],
  );
  const shiftOptions = React.useMemo(() => shiftRows.filter((row) => row.is_active), [shiftRows]);

  const todayAttendance = React.useMemo(
    () => attendanceRows.find((row) => row.user_id === me?.id) ?? null,
    [attendanceRows, me?.id],
  );

  const assignment: AssignmentLike = React.useMemo(() => {
    const shift = myActiveAssignment ? shiftById.get(myActiveAssignment.shift_id) : null;
    const shiftLabel = shift ? `${shift.name} (${shift.start_time}-${shift.end_time})` : "Belum ada shift aktif";

    return {
      user_name: me?.fullName ?? me?.username ?? "Petugas",
      place_name: activePlaceAccess ? `${activePlaceAccess.placeName} (${activePlaceAccess.placeCode})` : "Belum ada place",
      shift_name: shiftLabel,
      start_date: myActiveAssignment?.created_at ?? null,
      end_date: null,
    };
  }, [activePlaceAccess, me?.fullName, me?.username, myActiveAssignment, shiftById]);

  const recentLogs = React.useMemo<RecentLogLike[]>(() => {
    return recentActivityRows.slice(0, 6).map((row) => {
      const status = getMetaText(row.metadata, "status");

      if (row.activity_type === "PATROL_SPOT_SCAN") {
        return {
          id: row.activity_id,
          title: "Patrol spot selesai",
          subtitle: formatRelativeTime(row.activity_at),
        };
      }

      if (row.activity_type === "PATROL_FACILITY_SCAN") {
        return {
          id: row.activity_id,
          title: "Patrol facility selesai",
          subtitle: `${formatRelativeTime(row.activity_at)}${status ? ` (${status})` : ""}`,
        };
      }

      if (row.activity_type === "ATTENDANCE_CHECK_IN") {
        return {
          id: row.activity_id,
          title: "Absen masuk",
          subtitle: formatRelativeTime(row.activity_at),
        };
      }

      return {
        id: row.activity_id,
        title: "Absen keluar",
        subtitle: formatRelativeTime(row.activity_at),
      };
    });
  }, [recentActivityRows]);

  const statusText = meQuery.isLoading ? "Memuat..." : attendanceLabel(todayAttendance);
  const tone = attendanceTone(todayAttendance);

  const openPatrol = String(myActiveAssignment ? 1 : 0);
  const closedPatrol = String(recentActivitySummary.patrol_spot_today);
  const closedFacilityPatrol = String(recentActivitySummary.patrol_facility_today);
  const activeFacilityItems = String(recentActivitySummary.facility_active);
  const activeSpots = String(recentActivitySummary.spot_active || recentActivitySummary.point_active);
  const totalActivityMonth = String(recentActivitySummary.total_month);

  const dataError =
    meQuery.error ??
    assignmentQuery.error ??
    shiftQuery.error ??
    attendanceQuery.error ??
    recentActivityQuery.error;

  React.useEffect(() => {
    if (myActiveAssignment) return;
    if (selectedShiftId && shiftOptions.some((row) => row.id === selectedShiftId)) return;
    setSelectedShiftId(shiftOptions[0]?.id ?? "");
  }, [myActiveAssignment, selectedShiftId, shiftOptions]);

  React.useEffect(() => {
    const sync = () => setIsOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const jobs: Array<Promise<unknown>> = [meQuery.refetch()];
      if (activePlaceId) {
        jobs.push(assignmentQuery.refetch(), shiftQuery.refetch());
      }
      if (activePlaceId && me?.id) {
        jobs.push(attendanceQuery.refetch(), recentActivityQuery.refetch());
      }
      await Promise.allSettled(jobs);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    activePlaceId,
    assignmentQuery,
    attendanceQuery,
    me?.id,
    meQuery,
    recentActivityQuery,
    shiftQuery,
  ]);

  const checkInternetConnection = React.useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      setIsOffline(!navigator.onLine);
    } finally {
      setIsCheckingConnection(false);
    }
  }, []);

  const assignShiftAndOpenAttendanceCamera = React.useCallback(async () => {
    setShiftSetupError(null);

    if (!activePlaceId || !me?.id) {
      setShiftSetupError("Data user/place belum siap.");
      return;
    }
    if (!selectedShiftId) {
      setShiftSetupError("Pilih shift terlebih dahulu.");
      return;
    }

    setIsAssigningShift(true);
    try {
      await createAssignmentMut.mutateAsync({
        placeId: activePlaceId,
        userId: me.id,
        shiftId: selectedShiftId,
        isActive: true,
      });

      await assignmentQuery.refetch();
      router.push("/mobile/attendance/camera");
    } catch (e) {
      setShiftSetupError(e instanceof Error ? e.message : "Gagal membuat assignment shift.");
    } finally {
      setIsAssigningShift(false);
    }
  }, [
    activePlaceId,
    assignmentQuery,
    createAssignmentMut,
    me?.id,
    router,
    selectedShiftId,
  ]);

  const openAttendanceCamera = React.useCallback(() => {
    if (!myActiveAssignment) {
      setShiftSetupError("Pilih shift aktif dulu, lalu tekan Lanjut Kamera.");
      return;
    }
    router.push("/mobile/attendance/camera");
  }, [myActiveAssignment, router]);

  const openPatrolScanner = React.useCallback(async () => {
    if (isStartingPatrol) return;
    setPatrolError(null);

    if (!activePlaceId || !me?.id) {
      setPatrolError("Data user/place belum siap. Coba refresh.");
      return;
    }
    if (!myActiveAssignment) {
      setPatrolError("Belum ada spot assignment aktif untuk user ini.");
      return;
    }

    setIsStartingPatrol(true);
    try {
      router.push("/mobile/patrol/scan");
    } catch {
      setPatrolError("Gagal membuka scanner patroli.");
    } finally {
      setIsStartingPatrol(false);
    }
  }, [activePlaceId, isStartingPatrol, me?.id, myActiveAssignment, router]);

  const openFacilityPatrol = React.useCallback(async () => {
    if (isStartingFacilityPatrol) return;
    setFacilityPatrolError(null);

    if (!activePlaceId || !me?.id) {
      setFacilityPatrolError("Data user/place belum siap. Coba refresh.");
      return;
    }
    if (!myActiveAssignment) {
      setFacilityPatrolError("Belum ada spot assignment aktif untuk user ini.");
      return;
    }

    setIsStartingFacilityPatrol(true);
    try {
      router.push("/mobile/facility/scan");
    } catch {
      setFacilityPatrolError("Gagal membuka facility patrol.");
    } finally {
      setIsStartingFacilityPatrol(false);
    }
  }, [activePlaceId, isStartingFacilityPatrol, me?.id, myActiveAssignment, router]);

  const openSummaryDetail = React.useCallback(
    (type: "patrol-active" | "patrol-today" | "facility-today" | "spot-active" | "facility-item-active") => {
      router.push(`/mobile/dashboard/detail?type=${type}`);
    },
    [router],
  );

  const onLogout = React.useCallback(() => {
    document.cookie = "accessToken=; Path=/; Max-Age=0;";
    document.cookie = "petugasAccessToken=; Path=/; Max-Age=0;";
    try {
      window.localStorage.removeItem("petugasAccessToken");
      window.sessionStorage.removeItem("petugasAccessToken");
      window.localStorage.removeItem("accessToken");
      window.sessionStorage.removeItem("accessToken");
    } catch {}
    router.push("/mobile");
  }, [router]);

  return (
    <MobileWebShell contentClassName="bg-[#f3f6fb]">
    <div className="min-h-full bg-[#f3f6fb] pb-8">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-[430px] items-center justify-between px-4 py-3">
          <div className="text-[14px] font-extrabold text-slate-900">Dashboard</div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-800 active:scale-[0.98]"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] px-4 pb-8 pt-4">
        {dataError ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-bold text-rose-700">
            {dataError instanceof Error ? dataError.message : "Gagal memuat dashboard."}
          </div>
        ) : null}

        <div className="rounded-[26px] bg-gradient-to-br from-[#0b3a86] to-[#0ea5e9] p-4 shadow-[0_12px_26px_rgba(2,6,23,0.12)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-white/90">
                <User size={18} className="text-[#0b3a86]" />
              </div>
              <div>
                <div className="text-[14px] font-black text-white">{assignment.user_name}</div>
                <div className="mt-[1px] text-[12px] font-bold text-white/90">{assignment.place_name}</div>
              </div>
            </div>

            <div
              className="rounded-full border px-3 py-[6px] text-[11px] font-black"
              style={{ backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}
            >
              {statusText}
            </div>
          </div>

          <div className="mt-4 rounded-[18px] bg-white p-4 shadow-[0_10px_22px_rgba(11,58,134,0.18)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-[#0b3a86] px-3 py-[7px]">
                <BadgeCheck size={16} className="text-white" />
                <div className="text-[11px] font-black text-white">Satpam Aktif</div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-[7px]">
                <MapPinned size={14} className="text-[#0b3a86]" />
                <div className="text-[11px] font-black text-[#0b3a86]">{assignment.place_name}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-extrabold text-slate-500">Shift</div>
                <div className="mt-1 text-[12px] font-black text-slate-900">{assignment.shift_name}</div>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-extrabold text-slate-500">Periode</div>
                <div className="mt-1 text-[12px] font-black text-slate-900">
                  {formatDateRange(assignment.start_date, assignment.end_date)}
                </div>
              </div>
            </div>

            {!myActiveAssignment ? (
              <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3">
                <div className="text-[12px] font-black text-amber-900">Belum ada shift aktif. Pilih shift untuk lanjut attendance.</div>
                <div className="mt-2">
                  <select
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900"
                  >
                    <option value="">Pilih shift</option>
                    {shiftOptions.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({shift.start_time}-{shift.end_time})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void assignShiftAndOpenAttendanceCamera()}
                  disabled={isAssigningShift || !selectedShiftId || shiftOptions.length === 0}
                  className="mt-2 w-full rounded-xl bg-amber-600 px-3 py-2 text-[13px] font-black text-white disabled:opacity-60"
                >
                  {isAssigningShift ? "Menyimpan..." : "Update Shift & Lanjut Kamera"}
                </button>
                {shiftOptions.length === 0 ? (
                  <div className="mt-2 text-[11px] font-bold text-amber-800">Belum ada shift aktif di place ini.</div>
                ) : null}
                {shiftSetupError ? <div className="mt-2 text-[11px] font-bold text-red-700">{shiftSetupError}</div> : null}
              </div>
            ) : null}

            {myActiveAssignment ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={openAttendanceCamera}
                  className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-[#0b3a86] text-[13px] font-black text-white shadow-[0_10px_18px_rgba(11,58,134,0.25)] active:scale-[0.99]"
                >
                  <CalendarCheck size={18} className="text-white" />
                  Absen Sekarang
                </button>

                <button
                  type="button"
                  onClick={() => void openPatrolScanner()}
                  className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] border border-[#cfe3ff] bg-white text-[13px] font-black text-[#0b3a86] active:scale-[0.99]"
                >
                  <QrCode size={18} className="text-[#0b3a86]" />
                  {isStartingPatrol ? "Memulai..." : "Mulai Patrol"}
                </button>
              </div>
            ) : null}

            {patrolError ? <div className="mt-3 text-[12px] font-bold text-red-700">{patrolError}</div> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <div className="flex items-baseline justify-between">
              <div className="text-[16px] font-black text-slate-900">Ringkasan Hari Ini</div>
              <div className="text-[12px] font-extrabold text-slate-500">Update real-time</div>
            </div>

            <div className="mt-3 rounded-[16px] border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <CalendarCheck size={18} className="text-emerald-600" />
                <div className="text-[12px] font-extrabold text-slate-500">Status Absen</div>
              </div>
              <div className="mt-2 text-[14px] font-black text-slate-900">{statusText}</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openSummaryDetail("patrol-active")}
                className="rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="text-[11px] font-extrabold text-slate-500">Spot Patroli Aktif</div>
                <div className="mt-2 text-[16px] font-black text-slate-900">{openPatrol}</div>
              </button>
              <button
                type="button"
                onClick={() => openSummaryDetail("patrol-today")}
                className="rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="text-[11px] font-extrabold text-slate-500">Patroli Spot Hari Ini</div>
                <div className="mt-2 text-[16px] font-black text-slate-900">{closedPatrol}</div>
              </button>
              <button
                type="button"
                onClick={() => openSummaryDetail("facility-today")}
                className="rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="text-[11px] font-extrabold text-slate-500">Facility Hari Ini</div>
                <div className="mt-2 text-[16px] font-black text-slate-900">{closedFacilityPatrol}</div>
              </button>
              <button
                type="button"
                onClick={() => openSummaryDetail("spot-active")}
                className="rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="text-[11px] font-extrabold text-slate-500">Spot Aktif</div>
                <div className="mt-2 text-[16px] font-black text-slate-900">{activeSpots}</div>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openSummaryDetail("facility-item-active")}
                className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-left active:scale-[0.99]"
              >
                <div className="text-[11px] font-extrabold text-slate-500">Item Facility Aktif</div>
                <div className="mt-1 text-[14px] font-black text-slate-900">{activeFacilityItems}</div>
              </button>
              <div className="rounded-[14px] border border-slate-200 bg-white px-3 py-2">
                <div className="text-[11px] font-extrabold text-slate-500">Aktivitas Bulan Ini</div>
                <div className="mt-1 text-[14px] font-black text-slate-900">{totalActivityMonth}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <div className="text-[16px] font-black text-slate-900">Aksi Cepat</div>
              <div className="text-[12px] font-extrabold text-slate-500">Shortcut</div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={openAttendanceCamera}
                className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-emerald-50">
                  <CalendarCheck size={18} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-black text-slate-900">Absen Sekarang</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">Check-in / Check-out</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void openPatrolScanner()}
                className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-blue-50">
                  <QrCode size={18} className="text-[#0b3a86]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-black text-slate-900">Mulai Patrol</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">Session patroli</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void openFacilityPatrol()}
                className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white p-3 text-left active:scale-[0.99]"
              >
                <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-violet-50">
                  <Building2 size={18} className="text-violet-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-black text-slate-900">
                    {isStartingFacilityPatrol ? "Membuka..." : "Facility Patrol"}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">Checklist fasilitas</div>
                </div>
              </button>
            </div>
            {facilityPatrolError ? <div className="mt-3 text-[12px] font-bold text-red-700">{facilityPatrolError}</div> : null}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsRecentCollapsed((v) => !v)}
              className="flex w-full items-center justify-between rounded-[12px] px-1 py-1 active:bg-indigo-50"
            >
              <div className="flex items-baseline gap-2">
                <div className="text-[16px] font-black text-slate-900">Aktivitas Terkini</div>
                <div className="text-[12px] font-extrabold text-slate-500">Terakhir</div>
              </div>
              {isRecentCollapsed ? (
                <ChevronDown size={20} className="text-slate-500" />
              ) : (
                <ChevronUp size={20} className="text-slate-500" />
              )}
            </button>

            {isRecentCollapsed ? null : (
              <div className="mt-2 rounded-[16px] border border-slate-200 bg-white p-2">
                {recentLogs.map((it) => (
                  <div key={it.id} className="rounded-[12px] border border-slate-100 px-3 py-2">
                    <div className="truncate text-[13px] font-black text-slate-900">{it.title}</div>
                    <div className="mt-[2px] text-[11px] font-bold text-slate-500">{it.subtitle}</div>
                  </div>
                ))}
                {recentLogs.length === 0 ? (
                  <div className="px-2 py-3 text-[12px] font-bold text-slate-500">Belum ada aktivitas.</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {isOffline ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6">
          <div className="w-full max-w-[340px] rounded-[18px] border border-red-200 bg-white p-5 text-center shadow-[0_18px_30px_rgba(2,6,23,0.18)]">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-red-500">
              <WifiOff size={22} className="text-white" />
            </div>
            <div className="mt-3 text-[18px] font-black text-slate-900">Internet Offline</div>
            <div className="mt-2 text-[13px] font-bold text-slate-600">
              Koneksi internet terputus. Beberapa data dashboard tidak bisa diperbarui.
            </div>
            <button
              type="button"
              onClick={() => void checkInternetConnection()}
              className="mt-4 w-full rounded-[12px] bg-red-600 px-4 py-3 text-[13px] font-black text-white active:scale-[0.99]"
            >
              {isCheckingConnection ? "Mengecek..." : "Coba Lagi"}
            </button>
            <button
              type="button"
              onClick={() => setIsOffline(false)}
              className="mt-2 w-full rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-[13px] font-black text-slate-800 active:scale-[0.99]"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-20 mt-5 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[430px] items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg bg-slate-100 px-3 py-2 text-[13px] font-black text-slate-800 active:scale-[0.99]"
          >
            {"< Back"}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg bg-red-600 px-3 py-2 text-[13px] font-black text-white active:scale-[0.99]"
          >
            Logout
          </button>

          <button
            type="button"
            onClick={() => router.push("/mobile/dashboard")}
            className="rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-black text-white active:scale-[0.99]"
          >
            {"Next >"}
          </button>
        </div>
      </div>
    </div>
    </MobileWebShell>
  );
}
