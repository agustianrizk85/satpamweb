"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

export type TitleBarTab = {
  label: string;
  href: string;
  subLabel?: string;
};

type TitleBarTabsProps = {
  tabs?: readonly TitleBarTab[];
  topCandidates?: readonly TitleBarTab[];
  storageKey?: string;
  lowerTabsOffsetPx?: number;
  fallbackHref?: string;
  maxTopTabs?: number;
  enableTopTabs?: boolean;
};

function normalizeHref(href: string) {
  const raw = String(href ?? "").trim();
  const clean = (raw.split("?")[0] ?? raw).trim();
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

function cleanHrefKeepQuery(href: string) {
  const raw = String(href ?? "").trim();
  if (!raw) return "/";
  const [beforeHash, hash] = raw.split("#");
  const [pathRaw, queryRaw] = beforeHash.split("?");
  let path = (pathRaw ?? "").trim();
  if (!path) path = "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const query = (queryRaw ?? "").trim();
  const rebuilt = query ? `${path}?${query}` : path;
  return hash ? `${rebuilt}#${hash}` : rebuilt;
}

function isActivePath(pathname: string, href: string) {
  const p = normalizeHref(pathname);
  const h = normalizeHref(href);
  if (h === "/") return p === "/";
  return p === h || p.startsWith(`${h}/`);
}

function dedupeByHrefKeepLast(items: readonly TitleBarTab[]): TitleBarTab[] {
  const map = new Map<string, TitleBarTab>();
  for (const item of items) {
    const key = normalizeHref(item.href);
    if (!key) continue;
    if (map.has(key)) map.delete(key);
    map.set(key, { ...item, href: cleanHrefKeepQuery(item.href) });
  }
  return Array.from(map.values());
}

function upsertWithLimit(prev: TitleBarTab[], tab: TitleBarTab, limit: number): TitleBarTab[] {
  const key = normalizeHref(tab.href);
  const href = cleanHrefKeepQuery(tab.href);
  const idx = prev.findIndex((item) => normalizeHref(item.href) === key);

  let next: TitleBarTab[];
  if (idx >= 0) {
    const old = prev[idx];
    const label = tab.label ?? old.label;
    const subLabel = tab.subLabel ?? old.subLabel;
    if (old.label === label && old.subLabel === subLabel && old.href === href) return prev;
    next = [...prev];
    next[idx] = { ...old, href, label, subLabel };
  } else {
    next = [...prev, { ...tab, href }];
  }

  if (next.length > limit) next = next.slice(next.length - limit);
  return next;
}

function tabsEqual(a: TitleBarTab[], b: TitleBarTab[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return normalizeHref(item.href) === normalizeHref(other.href) && item.label === other.label && item.subLabel === other.subLabel;
  });
}

function useDragScroll<T extends HTMLElement>(thresholdPx = 10) {
  const ref = React.useRef<T | null>(null);

  const isDown = React.useRef(false);
  const dragging = React.useRef(false);
  const suppressClick = React.useRef(false);

  const startX = React.useRef(0);
  const startScrollLeft = React.useRef(0);
  const pointerId = React.useRef<number | null>(null);

  const setNoSelect = React.useCallback((on: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.userSelect = on ? "none" : "";
  }, []);

  const onPointerDownCapture = React.useCallback((e: React.PointerEvent<T>) => {
    if (e.button !== 0) return;
    const el = ref.current;
    if (!el) return;

    isDown.current = true;
    dragging.current = false;
    suppressClick.current = false;

    startX.current = e.clientX;
    startScrollLeft.current = el.scrollLeft;
    pointerId.current = e.pointerId;

    el.style.cursor = "grabbing";
  }, []);

  const onPointerMoveCapture = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (!isDown.current) return;
      const el = ref.current;
      if (!el) return;

      const dx = e.clientX - startX.current;

      if (!dragging.current) {
        if (Math.abs(dx) < thresholdPx) return;

        dragging.current = true;
        suppressClick.current = true;

        if (pointerId.current !== null) {
          try {
            el.setPointerCapture(pointerId.current);
          } catch {
            return;
          }
        }

        setNoSelect(true);
      }

      e.preventDefault();
      e.stopPropagation();

      el.scrollLeft = startScrollLeft.current - dx;
    },
    [thresholdPx, setNoSelect],
  );

  const endDrag = React.useCallback(() => {
    const el = ref.current;
    isDown.current = false;
    dragging.current = false;
    pointerId.current = null;
    setNoSelect(false);
    if (el) el.style.cursor = "grab";
  }, [setNoSelect]);

  const onPointerUpCapture = React.useCallback(
    (e: React.PointerEvent<T>) => {
      const el = ref.current;
      if (el && suppressClick.current) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          return;
        }
      }
      endDrag();
    },
    [endDrag],
  );

  const onPointerCancelCapture = React.useCallback(() => {
    endDrag();
  }, [endDrag]);

  const onClickCapture = React.useCallback((e: React.MouseEvent<T>) => {
    if (!suppressClick.current) return;

    e.preventDefault();
    e.stopPropagation();

    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (el) el.style.cursor = "grab";
  }, []);

  return [ref, onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture, onPointerCancelCapture, onClickCapture] as const;
}

export default function TitleBarTabs({
  tabs = [],
  topCandidates = [],
  storageKey = "wms.topTabs",
  lowerTabsOffsetPx = 12,
  fallbackHref,
  maxTopTabs = 8,
  enableTopTabs = true,
}: TitleBarTabsProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const lowerTabs = React.useMemo(() => dedupeByHrefKeepLast(tabs), [tabs]);
  const upperPool = React.useMemo(() => dedupeByHrefKeepLast([...topCandidates, ...lowerTabs]), [topCandidates, lowerTabs]);
  const upperPoolKey = React.useMemo(
    () => upperPool.map((item) => `${normalizeHref(item.href)}|${item.label}|${item.subLabel ?? ""}`).join("||"),
    [upperPool],
  );

  const safeFallback = React.useMemo(() => {
    const fallback = fallbackHref || lowerTabs[0]?.href || "/";
    return cleanHrefKeepQuery(fallback);
  }, [fallbackHref, lowerTabs]);

  const [topTabs, setTopTabs] = React.useState<TitleBarTab[]>([]);

  React.useEffect(() => {
    if (!enableTopTabs) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const restored = dedupeByHrefKeepLast(parsed as TitleBarTab[]).slice(-maxTopTabs);
      setTopTabs((prev) => (tabsEqual(prev, restored) ? prev : restored));
    } catch {
      return;
    }
  }, [enableTopTabs, maxTopTabs, storageKey]);

  React.useEffect(() => {
    if (!enableTopTabs) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(topTabs));
    } catch {
      return;
    }
  }, [enableTopTabs, storageKey, topTabs]);

  React.useEffect(() => {
    if (!enableTopTabs) return;
    const match = upperPool.find((item) => isActivePath(pathname, item.href));
    if (!match) return;
    setTopTabs((prev) => {
      if (prev.some((item) => normalizeHref(item.href) === normalizeHref(match.href))) return prev;
      return upsertWithLimit(prev, match, maxTopTabs);
    });
  }, [enableTopTabs, maxTopTabs, pathname, upperPool, upperPoolKey]);

  React.useEffect(() => {
    if (!enableTopTabs) return;
    setTopTabs((prev) => {
      let changed = false;
      const byHref = new Map(upperPool.map((item) => [normalizeHref(item.href), item]));
      const next = prev.map((tab) => {
        if (tab.subLabel) return tab;
        const found = byHref.get(normalizeHref(tab.href));
        if (found?.subLabel) {
          changed = true;
          return { ...tab, subLabel: found.subLabel };
        }
        return tab;
      });
      return changed ? next : prev;
    });
  }, [enableTopTabs, upperPool, upperPoolKey]);

  const renderTopTabs = React.useMemo(() => (enableTopTabs ? dedupeByHrefKeepLast(topTabs) : []), [enableTopTabs, topTabs]);

  const addTopTab = React.useCallback(
    (tab: TitleBarTab) => {
      if (!enableTopTabs) return;
      setTopTabs((prev) => upsertWithLimit(prev, tab, maxTopTabs));
    },
    [enableTopTabs, maxTopTabs],
  );

  const removeTopTab = React.useCallback(
    (href: string) => {
      if (!enableTopTabs) return;
      const current = normalizeHref(href);
      setTopTabs((prev) => prev.filter((item) => normalizeHref(item.href) !== current));
    },
    [enableTopTabs],
  );

  const [dragTopRef, dragTopPointerDownCapture, dragTopPointerMoveCapture, dragTopPointerUpCapture, dragTopPointerCancelCapture, dragTopClickCapture] =
    useDragScroll<HTMLDivElement>(12);
  const [dragLowerRef, dragLowerPointerDownCapture, dragLowerPointerMoveCapture, dragLowerPointerUpCapture, dragLowerPointerCancelCapture, dragLowerClickCapture] =
    useDragScroll<HTMLDivElement>(12);

  return (
    <div className="w-full">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {enableTopTabs && renderTopTabs.length > 0 ? (
        <>
          <div
            ref={dragTopRef}
            onPointerDownCapture={dragTopPointerDownCapture}
            onPointerMoveCapture={dragTopPointerMoveCapture}
            onPointerUpCapture={dragTopPointerUpCapture}
            onPointerCancelCapture={dragTopPointerCancelCapture}
            onClickCapture={dragTopClickCapture}
            className="no-scrollbar max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap px-3 pt-3 sm:px-4 md:px-0 md:pt-0"
          >
            <div className="flex min-w-max items-stretch gap-2">
              {renderTopTabs.map((tab, index) => {
                const active = isActivePath(pathname, tab.href);
                return (
                  <div
                    key={`${normalizeHref(tab.href)}-${index}`}
                    className={clsx("relative inline-flex shrink-0", index === 0 && "md:-ml-px")}
                  >
                    <a
                      href={tab.href}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(tab.href);
                      }}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "relative inline-flex min-w-[172px] max-w-[300px] shrink-0 select-none items-center rounded-[22px] border px-4 py-3.5 text-[12px] shadow-[0_16px_28px_rgba(76,99,168,0.12)] backdrop-blur",
                        active
                          ? "border-white/80 bg-white/92 text-slate-900"
                          : "border-white/60 bg-white/55 text-slate-700 hover:bg-white/75 hover:text-slate-900",
                        index === 0 && "md:rounded-l-none md:border-l-0",
                        "pr-9",
                      )}
                    >
                      <span className="flex min-w-0 flex-col items-start leading-tight">
                        <span className="truncate font-semibold">{tab.label}</span>
                        {tab.subLabel ? <span className="truncate text-[10px] text-slate-500">{tab.subLabel}</span> : null}
                      </span>

                      <button
                        type="button"
                        title="Close"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const wasActive = isActivePath(pathname, tab.href);
                          removeTopTab(tab.href);
                          if (wasActive) router.push(safeFallback);
                        }}
                        className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        x
                      </button>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {lowerTabs.length > 0 ? (
            <div className="border-t border-white/60 px-3 pb-3 sm:px-4 md:px-0">
              <div
                ref={dragLowerRef}
                onPointerDownCapture={dragLowerPointerDownCapture}
                onPointerMoveCapture={dragLowerPointerMoveCapture}
                onPointerUpCapture={dragLowerPointerUpCapture}
                onPointerCancelCapture={dragLowerPointerCancelCapture}
                onClickCapture={dragLowerClickCapture}
                className="no-scrollbar max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap pt-2"
              >
                <nav className="flex min-w-max items-center gap-3" style={{ marginLeft: lowerTabsOffsetPx }}>
                  {lowerTabs.map((tab, index) => {
                    const active = isActivePath(pathname, tab.href);
                    return (
                      <a
                        key={`${normalizeHref(tab.href)}-${index}`}
                        href={tab.href}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          addTopTab({ label: tab.label, href: tab.href, subLabel: tab.subLabel });
                          router.push(tab.href);
                        }}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "relative rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap",
                          active
                            ? "bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(236,72,153,0.14))] text-slate-900"
                            : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
                        )}
                      >
                        {tab.label}
                        <span
                          className={clsx(
                            "pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full",
                            active ? "bg-sky-500" : "bg-transparent",
                          )}
                        />
                      </a>
                    );
                  })}
                </nav>
              </div>
            </div>
          ) : null}
        </>
      ) : lowerTabs.length > 0 ? (
        <div
          ref={dragLowerRef}
          onPointerDownCapture={dragLowerPointerDownCapture}
          onPointerMoveCapture={dragLowerPointerMoveCapture}
          onPointerUpCapture={dragLowerPointerUpCapture}
          onPointerCancelCapture={dragLowerPointerCancelCapture}
          onClickCapture={dragLowerClickCapture}
          className="no-scrollbar max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap px-3 py-3 sm:px-4 md:px-0 md:py-0"
        >
          <nav className="flex min-w-max items-center gap-3" style={{ marginLeft: lowerTabsOffsetPx }}>
            {lowerTabs.map((tab, index) => {
              const active = isActivePath(pathname, tab.href);
              return (
                <a
                  key={`${normalizeHref(tab.href)}-${index}`}
                  href={tab.href}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    addTopTab({ label: tab.label, href: tab.href, subLabel: tab.subLabel });
                    router.push(tab.href);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap",
                    active
                      ? "bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(236,72,153,0.14))] text-slate-900"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
                  )}
                >
                  {tab.label}
                  <span
                    className={clsx(
                      "pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full",
                      active ? "bg-sky-500" : "bg-transparent",
                    )}
                  />
                </a>
              );
            })}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
