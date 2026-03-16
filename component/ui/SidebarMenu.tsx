"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type MenuLeafItem<T extends string> = {
  key: T;
  label: string;
  icon?: ReactNode;
};

type MenuGroupItem<T extends string> = {
  label: string;
  icon?: ReactNode;
  children: readonly MenuLeafItem<T>[];
};

type MenuItem<T extends string> = MenuLeafItem<T> | MenuGroupItem<T>;

type SidebarMenuProps<T extends string> = {
  title?: string;
  items: readonly MenuItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
};

export default function SidebarMenu<T extends string>({
  title = "Menu",
  items,
  activeKey,
  onChange,
}: SidebarMenuProps<T>) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(label: string, currentOpen: boolean) {
    setOpenGroups((prev) => ({ ...prev, [label]: !currentOpen }));
  }

  return (
    <div className="p-4">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">{title}</p>

      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {items.map((item) => {
          if ("children" in item) {
            const hasActiveChild = item.children.some((child) => child.key === activeKey);
            const isOpen = openGroups[item.label] ?? hasActiveChild;

            return (
              <div key={item.label} className="min-w-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label, isOpen)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                    hasActiveChild
                      ? "bg-[linear-gradient(135deg,rgba(56,189,248,0.24),rgba(168,85,247,0.22),rgba(236,72,153,0.24))] text-white shadow-[0_16px_28px_rgba(15,23,42,0.18)]"
                      : "bg-transparent text-slate-200 hover:bg-white/8"
                  }`}
                  aria-expanded={isOpen}
                >
                  {item.icon ? <span className="shrink-0 text-current">{item.icon}</span> : null}
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                </button>

                {isOpen ? (
                  <div className="mt-2 space-y-1.5 pl-2">
                    {item.children.map((child) => {
                      const active = child.key === activeKey;
                      return (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => onChange(child.key)}
                          className={`flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm transition ${
                            active
                              ? "bg-white text-slate-900 shadow-[0_14px_24px_rgba(15,23,42,0.12)]"
                              : "text-slate-300 hover:bg-white/8 hover:text-white"
                          }`}
                          aria-current={active ? "page" : undefined}
                        >
                          {child.icon ? <span className="shrink-0">{child.icon}</span> : null}
                          <span className="truncate">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                active
                  ? "bg-[linear-gradient(135deg,rgba(56,189,248,0.24),rgba(168,85,247,0.22),rgba(236,72,153,0.24))] text-white shadow-[0_16px_28px_rgba(15,23,42,0.18)]"
                  : "bg-transparent text-slate-200 hover:bg-white/8"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export type { MenuGroupItem, MenuItem, MenuLeafItem };

