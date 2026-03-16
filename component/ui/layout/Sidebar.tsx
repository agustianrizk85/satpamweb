"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  LayoutGrid,
  MapPinned,
  ClipboardCheck,
  QrCode,
  Users,
  Shield,
  Building2,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type Section = { title: string; items: NavItem[] };

function normalizePath(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return "/";
  const base = raw.split("#")[0] ?? raw;
  const noQuery = base.split("?")[0] ?? base;
  const trimmed = noQuery.replace(/\/+$/, "");
  return trimmed || "/";
}

function isActive(href: string, path: string) {
  const current = normalizePath(path);
  const target = normalizePath(href);
  return current === target || current.startsWith(`${target}/`);
}

export default function Sidebar({
  markLogo = "/images/brand/Union.svg",
  appTitle = "Satpam",
  appVersion = "v1",
  defaultCollapsed = false,
  displayName = "User",
  displayEmail = "",
  onLogout,
}: {
  markLogo?: string;
  appTitle?: string;
  appVersion?: string;
  defaultCollapsed?: boolean;
  displayName?: string;
  displayEmail?: string;
  onLogout?: () => void;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { t } = useTranslation();

  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  const initials = useMemo(() => {
    const name = (displayName || "User").trim();
    const parts = name.split(/\s+/);
    const letters = parts
      .slice(0, 2)
      .map((p) => (p[0] ? p[0].toUpperCase() : ""))
      .join("");
    return letters || "US";
  }, [displayName]);

  const SECTIONS: Section[] = useMemo(
    () => [
      {
        title: t("sidebar.sections.main", "Main"),
        items: [
          { label: t("sidebar.dashboard", "Dashboard"), href: "/dashboard", icon: LayoutGrid },
        ],
      },
      {
        title: t("sidebar.sections.menu", "Menu"),
        items: [
          { label: t("sidebar.attendance", "Attendance"), href: "/attendance", icon: ClipboardCheck },
          { label: t("sidebar.patrol", "Patrol"), href: "/patrol", icon: QrCode },
          { label: t("sidebar.patrolRoutes", "Patrol Routes"), href: "/patrol-routes", icon: MapPinned },
          { label: t("sidebar.shifts", "Shifts"), href: "/shifts", icon: CalendarClock },
          { label: t("sidebar.users", "Users"), href: "/users", icon: Users },
          { label: t("sidebar.roles", "Roles"), href: "/roles", icon: Shield },
          { label: t("sidebar.places", "Places"), href: "/places", icon: Building2 },
        ],
      },
    ],
    [t],
  );

  const TOP_ITEMS: NavItem[] = useMemo(
    () => SECTIONS.flatMap((s) => s.items),
    [SECTIONS],
  );

  const widthClass = collapsed ? "w-[60px] px-2.5 py-3" : "w-[240px] px-4 py-4";

  const handleLogout = () => {
    onLogout?.();
    router.push("/login");
  };

  const userBadge: ReactNode = (
    <div className="mt-1 rounded-2xl border border-neutral-200 bg-white p-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-900 text-[11px] font-semibold text-white">
          {initials}
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-neutral-900">{displayName}</div>
            {displayEmail ? (
              <div className="truncate text-[11px] text-neutral-600">{displayEmail}</div>
            ) : null}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className={clsx(
            "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50",
            collapsed ? "h-9 w-9" : "h-9 w-9",
          )}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4 text-neutral-700" />
        </button>
      </div>
    </div>
  );

  return (
    <aside
      className={clsx(
        "flex h-screen flex-col border-r border-neutral-200 bg-white shadow-sm",
        "transition-[width,padding] duration-300 ease-out",
        widthClass,
      )}
    >
      {collapsed ? (
        <div className="mb-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <ChevronsRight className="h-4 w-4 text-neutral-700" />
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center">
          <div className="flex items-center gap-2.5">
            <Image
              src={markLogo}
              alt="Brand"
              width={48}
              height={48}
              className="rounded-lg"
              priority
            />
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-neutral-900">{appTitle}</div>
              <div className="text-[10px] text-neutral-500">{appVersion}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <ChevronsLeft className="h-4 w-4 text-neutral-700" />
          </button>
        </div>
      )}

      <div className="mb-3 h-px w-full bg-neutral-200" />

      {collapsed ? (
        <>
          <nav className="flex-1">
            <ul className="flex flex-col items-center gap-4">
              {TOP_ITEMS.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={clsx(
                        "flex h-8 w-8 items-center justify-center rounded-2xl border text-neutral-700",
                        active ? "border-neutral-900 bg-neutral-900 text-white" : "border-transparent hover:bg-neutral-100",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-3 flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-900 text-[11px] font-semibold text-white">
              {initials}
            </div>
          </div>
        </>
      ) : (
        <>
          <nav className="flex-1 pr-1">
            {SECTIONS.map((section) => (
              <div key={section.title} className="mb-4">
                <div className="mb-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {section.title}
                </div>

                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActive(item.href, pathname);
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={clsx(
                            "group flex items-center rounded-xl px-2.5 py-2",
                            active ? "bg-neutral-900 text-white" : "hover:bg-neutral-50",
                          )}
                        >
                          <Icon
                            className={clsx(
                              "h-[17px] w-[17px] shrink-0",
                              active ? "text-white" : "text-neutral-700",
                            )}
                          />
                          <span
                            className={clsx(
                              "ml-2.5 truncate text-[13px] font-medium",
                              active ? "text-white" : "text-neutral-800",
                            )}
                            title={item.label}
                          >
                            {item.label}
                          </span>
                          <ChevronRight
                            className={clsx(
                              "ml-auto h-3.5 w-3.5 shrink-0",
                              active ? "text-white" : "text-neutral-400",
                            )}
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {userBadge}
        </>
      )}
    </aside>
  );
}