"use client";

import * as React from "react";
import clsx from "clsx";
import { useSearchParams } from "next/navigation";
import type { TitleBarTab } from "./TitleBarTabs";
import dynamic from "next/dynamic";

const TitleBarTabs = dynamic(() => import("@/component/ui/layout/TitleBarTabs"), { ssr: false });

export type Tab = TitleBarTab;

type TitleBarSize = "md" | "lg";

export type TitleBarProps = {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  tabs?: readonly TitleBarTab[];
  topCandidates?: readonly TitleBarTab[];
  fallbackHref?: string;
  lowerTabsOffsetPx?: number;
  enableTopTabs?: boolean;
  rightActions?: React.ReactNode;
  className?: string;

  size?: TitleBarSize;
};

export default function TitleBar({
  title,
  subTitle,
  tabs = [],
  topCandidates = [],
  fallbackHref,
  lowerTabsOffsetPx,
  enableTopTabs = true,
  rightActions,
  className,
  size = "md",
}: TitleBarProps) {
  const hasHeader = Boolean(title || subTitle || rightActions);

  const search = useSearchParams();
  const code = (search.get("code") ?? "").trim();

  const normalizedFallbackHref = React.useMemo(() => {
    if (!fallbackHref) return fallbackHref;
    if (!code) return fallbackHref;
    if (fallbackHref.includes("code=")) return fallbackHref;
    const joiner = fallbackHref.includes("?") ? "&" : "?";
    return `${fallbackHref}${joiner}code=${encodeURIComponent(code)}`;
  }, [fallbackHref, code]);

  const headerPad = size === "lg" ? "px-4 sm:px-5 lg:px-6 xl:px-8" : "px-6";
  const headerPy = size === "lg" ? "py-3" : "py-4";
  const titleSize = size === "lg" ? "text-xl" : "text-lg";
  const subTitleSize = size === "lg" ? "text-sm" : "text-sm";

  return (
    <header className={clsx("w-full bg-white", className)}>
      {hasHeader && (
        <div className={clsx("flex items-center justify-between gap-4", headerPad, headerPy)}>
          <div className="min-w-0">
            {title && <h1 className={clsx("truncate font-semibold text-neutral-900", titleSize)}>{title}</h1>}
            {subTitle && <p className={clsx("mt-1 truncate text-neutral-500", subTitleSize)}>{subTitle}</p>}
          </div>
          {rightActions && <div className="flex flex-shrink-0 items-center gap-2">{rightActions}</div>}
        </div>
      )}

      {tabs.length > 0 && (
        <TitleBarTabs
          tabs={tabs}
          topCandidates={topCandidates}
          fallbackHref={normalizedFallbackHref}
          lowerTabsOffsetPx={lowerTabsOffsetPx}
          enableTopTabs={enableTopTabs}
        />
      )}
    </header>
  );
}
