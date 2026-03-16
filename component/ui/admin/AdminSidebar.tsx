"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  ClipboardSignature,
  FileCheck2,
  LayoutGrid,
  LogOut,
  MapPinned,
  QrCode,
  Route,
  ScanLine,
  Settings,
  Shield,
  Sparkles,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

import Button from "@/component/ui/Button";
import SidebarMenu, { type MenuItem } from "@/component/ui/SidebarMenu";

type AdminMenuKey =
  | "dashboard"
  | "attendance"
  | "attendance-config"
  | "patrol"
  | "patrol-routes"
  | "patrol-route-points"
  | "patrol-scans"
  | "leave-requests"
  | "facility-spots"
  | "facility-items"
  | "facility-scans"
  | "shifts"
  | "users"
  | "roles"
  | "places"
  | "spots"
  | "spot-assignments"
  | "place-admins";

const ROUTE_BY_KEY: Record<AdminMenuKey, string> = {
  dashboard: "/web/dashboard",
  attendance: "/web/attendance",
  "attendance-config": "/web/attendance-config",
  patrol: "/web/patrol",
  "patrol-routes": "/web/patrol-routes",
  "patrol-route-points": "/web/patrol-route-points",
  "patrol-scans": "/web/patrol-scans",
  "leave-requests": "/web/leave-requests",
  "facility-spots": "/web/facility-spots",
  "facility-items": "/web/facility-items",
  "facility-scans": "/web/facility-scans",
  shifts: "/web/shifts",
  users: "/web/users",
  roles: "/web/roles",
  places: "/web/places",
  spots: "/web/spots",
  "spot-assignments": "/web/spot-assignments",
  "place-admins": "/web/place-admins",
};

const PETUGAS_ROLE_CODES = new Set(["GUARD"]);

function normalizePath(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return "/";
  const base = raw.split("#")[0] ?? raw;
  const noQuery = base.split("?")[0] ?? base;
  const trimmed = noQuery.replace(/\/+$/, "");
  return trimmed || "/";
}

function activeKeyFromPath(pathname: string): AdminMenuKey {
  const p = normalizePath(pathname);

  const entries = Object.entries(ROUTE_BY_KEY) as Array<[AdminMenuKey, string]>;
  for (const [key, href] of entries) {
    const currentHref = normalizePath(href);
    if (p === currentHref || p.startsWith(`${currentHref}/`)) return key;
  }
  return "dashboard";
}

function readRoleFromAuthStorage(): string {
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

function clearCookie(name: string) {
  const safe = encodeURIComponent(name);
  document.cookie = `${safe}=; Path=/; Max-Age=0`;
  document.cookie = `${safe}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export default function AdminSidebar({
  markLogo = "/azka.jpg",
  appTitle = "AZKACORPNEW 2",
  appVersion = "Admin Console",
  displayName = "Admin",
  displayEmail = "",
  loginPath = "/web/login",
}: {
  markLogo?: string;
  appTitle?: string;
  appVersion?: string;
  displayName?: string;
  displayEmail?: string;
  loginPath?: string;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const activeKey = React.useMemo(() => activeKeyFromPath(pathname), [pathname]);
  const [roleCode, setRoleCode] = React.useState<string>(() => readRoleFromAuthStorage());
  const isPetugas = PETUGAS_ROLE_CODES.has(roleCode);

  React.useEffect(() => {
    setRoleCode(readRoleFromAuthStorage());
  }, [pathname]);

  const onLogout = React.useCallback(() => {
    try {
      window.localStorage.removeItem("accessToken");
      window.localStorage.removeItem("authUser");
      window.sessionStorage.removeItem("accessToken");
      window.sessionStorage.removeItem("authUser");
      clearCookie("accessToken");
      clearCookie("wms_token");
      clearCookie("satpam_token");
    } finally {
      router.replace(loginPath);
    }
  }, [loginPath, router]);

  const items = React.useMemo<readonly MenuItem<AdminMenuKey>[]>(
    () =>
      (isPetugas
        ? [
            {
              label: "Operasional",
              icon: <ClipboardCheck className="h-4 w-4" />,
              children: [
                { key: "attendance", label: "Attendance", icon: <ClipboardCheck className="h-4 w-4" /> },
                { key: "patrol-scans", label: "Patrol Scans", icon: <ScanLine className="h-4 w-4" /> },
              ],
            },
            {
              label: "Facility",
              icon: <Wrench className="h-4 w-4" />,
              children: [{ key: "facility-scans", label: "Facility Scans", icon: <ScanLine className="h-4 w-4" /> }],
            },
          ]
        : [
            {
              label: "Main",
              icon: <LayoutGrid className="h-4 w-4" />,
              children: [{ key: "dashboard", label: "Dashboard", icon: <LayoutGrid className="h-4 w-4" /> }],
            },
            {
              label: "Operasional",
              icon: <ClipboardCheck className="h-4 w-4" />,
              children: [
                { key: "attendance", label: "Attendance", icon: <ClipboardCheck className="h-4 w-4" /> },
                { key: "attendance-config", label: "Attendance Config", icon: <Settings className="h-4 w-4" /> },
                { key: "leave-requests", label: "Leave Requests", icon: <ClipboardSignature className="h-4 w-4" /> },
                { key: "patrol", label: "Patrol", icon: <QrCode className="h-4 w-4" /> },
                { key: "patrol-routes", label: "Patrol Routes", icon: <MapPinned className="h-4 w-4" /> },
                { key: "patrol-route-points", label: "Route Points", icon: <Route className="h-4 w-4" /> },
                { key: "patrol-scans", label: "Patrol Scans", icon: <ScanLine className="h-4 w-4" /> },
              ],
            },
            {
              label: "Facility",
              icon: <Wrench className="h-4 w-4" />,
              children: [
                { key: "facility-spots", label: "Facility Spots", icon: <MapPinned className="h-4 w-4" /> },
                { key: "facility-items", label: "Facility Items", icon: <FileCheck2 className="h-4 w-4" /> },
                { key: "facility-scans", label: "Facility Scans", icon: <ScanLine className="h-4 w-4" /> },
              ],
            },
            {
              label: "Master",
              icon: <Users className="h-4 w-4" />,
              children: [
                { key: "shifts", label: "Shifts", icon: <CalendarClock className="h-4 w-4" /> },
                { key: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
                { key: "roles", label: "Roles", icon: <Shield className="h-4 w-4" /> },
                { key: "places", label: "Places", icon: <Building2 className="h-4 w-4" /> },
                { key: "spots", label: "Spots", icon: <MapPinned className="h-4 w-4" /> },
                { key: "spot-assignments", label: "Spot Assignments", icon: <ClipboardList className="h-4 w-4" /> },
                { key: "place-admins", label: "Place Admins", icon: <UserCheck className="h-4 w-4" /> },
              ],
            },
          ]) as readonly MenuItem<AdminMenuKey>[],
    [isPetugas],
  );

  const roleLabel = roleCode || (isPetugas ? "GUARD" : "SUPER_ADMIN");

  return (
    <div className="h-full px-3 pt-3 sm:px-5 sm:pt-5 md:px-0 md:pt-0">
      <aside className="flex h-full min-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[30px] border border-white/65 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96))] text-white shadow-[0_32px_70px_rgba(15,23,42,0.28)] md:min-h-full md:rounded-r-none md:border-r-0 md:shadow-none">
        <div className="relative overflow-hidden border-b border-white/10 p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.24),transparent_32%)]" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-2xl bg-white/92 px-2.5 shadow-[0_12px_24px_rgba(15,23,42,0.16)]">
                <Image
                  src={markLogo}
                  alt="Brand"
                  width={180}
                  height={36}
                  className="h-auto w-full object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-[0.01em] text-white">{appTitle}</div>
                <div className="mt-1 text-xs text-slate-300">{appVersion}</div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Live
            </span>
          </div>

          <div className="relative mt-5 rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-md">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Signed in as</div>
            <div className="mt-2 text-base font-semibold text-white">{displayName}</div>
            <div className="mt-1 truncate text-sm text-slate-300">{displayEmail || "admin@satpam.local"}</div>
            <div className="mt-3 inline-flex rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-amber-100">
              {roleLabel}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3">
          <div className="flex h-full min-h-0 flex-col rounded-[26px] border border-white/8 bg-white/8 backdrop-blur-md">
            <div className="border-b border-white/8 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Navigation</div>
              <div className="mt-1 text-xs text-slate-400">Akses cepat ke modul yang paling sering dipakai.</div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <SidebarMenu<AdminMenuKey>
                title="Menu utama"
                items={items}
                activeKey={activeKey}
                onChange={(key) => router.push(ROUTE_BY_KEY[key])}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <Button variant="secondary" className="w-full justify-center gap-2 bg-white text-slate-900 hover:bg-slate-50" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
    </div>
  );
}
