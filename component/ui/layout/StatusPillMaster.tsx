// src/components/ui/shared/StatusPillMaster.tsx
"use client";

import * as React from "react";

export type StatusPillMasterProps = {
  active?: boolean;
  activeText?: React.ReactNode;
  inactiveText?: React.ReactNode;
  statusRaw?: unknown;
  statusName?: unknown;
  statusCode?: unknown;
};

const asText = (v: unknown) => String(v ?? "").trim();

export function normalizeStatusToken(raw: string) {
  return raw.trim().toLowerCase().replaceAll("_", " ");
}

export function statusLabelFromRaw(raw: string) {
  const v = normalizeStatusToken(raw);
  if (!v) return "-";
  if (v.includes("close") || v.includes("done") || v.includes("finish")) return "Closed";
  if (v.includes("on progress") || v.includes("progress")) return "On Progress";
  if (v.includes("open")) return "Open";
  return raw.trim() || "-";
}

export default function StatusPillMaster({
  active,
  activeText,
  inactiveText,
  statusRaw,
  statusName,
  statusCode,
}: StatusPillMasterProps) {
  const raw = asText(statusRaw) || asText(statusName) || asText(statusCode);
  const hasStatus = raw.length > 0;

  let label: React.ReactNode;
  let toneClass = "bg-neutral-100 text-neutral-500 ring-neutral-300";

  if (hasStatus) {
    const normalized = normalizeStatusToken(raw);
    label = statusLabelFromRaw(raw);

    if (normalized.includes("on progress") || normalized.includes("progress")) {
      toneClass = "bg-amber-50 text-amber-700 ring-amber-200";
    } else if (normalized.includes("open")) {
      toneClass = "bg-sky-50 text-sky-700 ring-sky-200";
    } else if (normalized.includes("close") || normalized.includes("done") || normalized.includes("finish")) {
      toneClass = "bg-neutral-100 text-neutral-600 ring-neutral-300";
    } else {
      toneClass = "bg-neutral-100 text-neutral-600 ring-neutral-300";
    }
  } else {
    const isActive = Boolean(active);
    label = isActive ? activeText ?? "Active" : inactiveText ?? "Inactive";
    toneClass = isActive
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-neutral-100 text-neutral-500 ring-neutral-300";
  }

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ring-1",
        toneClass,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
