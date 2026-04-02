import * as React from "react";

import Shell from "@/component/ui/Shell";
import TitleBarTabs, { type TitleBarTab } from "@/component/ui/layout/TitleBarTabs";
import AdminGate from "@/component/ui/admin/AdminGate";
import AdminSidebar from "@/component/ui/admin/AdminSidebar";

const TOP_TAB_CANDIDATES: readonly TitleBarTab[] = [
  { label: "Dashboard", href: "/web/dashboard", subLabel: "Ringkasan" },
  { label: "Dashboard", href: "/dashboard", subLabel: "Ringkasan" },
  { label: "Attendance", href: "/web/attendance", subLabel: "Check-in/out" },
  { label: "Visitor Log", href: "/web/visitor-log", subLabel: "Log tamu" },
  { label: "Attendance Config", href: "/web/attendance-config", subLabel: "Konfigurasi" },
  { label: "Token Config", href: "/web/token-config", subLabel: "JWT TTL" },
  { label: "Leave Requests", href: "/web/leave-requests", subLabel: "Pengajuan" },
  { label: "Patrol", href: "/web/patrol", subLabel: "Scan QR" },
  { label: "Patrol Runs", href: "/web/patrol-runs", subLabel: "Ronde" },
  { label: "Patrol Routes", href: "/web/patrol-routes", subLabel: "Rute" },
  { label: "Route Points", href: "/web/patrol-route-points", subLabel: "Titik rute" },
  { label: "Patrol Scans", href: "/web/patrol-scans", subLabel: "Log scan" },
  { label: "Facility Spots", href: "/web/facility-spots", subLabel: "Titik facility" },
  { label: "Facility Items", href: "/web/facility-items", subLabel: "Checklist" },
  { label: "Facility Scans", href: "/web/facility-scans", subLabel: "Hasil scan" },
  { label: "Shifts", href: "/web/shifts", subLabel: "Jam kerja" },
  { label: "Users", href: "/web/users", subLabel: "Akun" },
  { label: "Roles", href: "/web/roles", subLabel: "Hak akses" },
  { label: "Places", href: "/web/places", subLabel: "Site" },
  { label: "Spots", href: "/web/spots", subLabel: "Titik patroli" },
  { label: "Spot Assignments", href: "/web/spot-assignments", subLabel: "Penugasan" },
  { label: "Place Admins", href: "/web/place-admins", subLabel: "Relasi user-place-role" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate redirectTo="/web/login" cookieName="accessToken" storageKey="accessToken">
      <Shell
        sidebar={<AdminSidebar />}
        header={<TitleBarTabs tabs={[]} topCandidates={TOP_TAB_CANDIDATES} fallbackHref="/web/dashboard" enableTopTabs />}
      >
        {children}
      </Shell>
    </AdminGate>
  );
}
