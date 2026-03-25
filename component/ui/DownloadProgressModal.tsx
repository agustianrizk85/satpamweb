"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";

type DownloadProgressModalProps = {
  open: boolean;
  percent: number;
  title?: string;
  subtitle?: string;
  loadedBytes?: number;
  totalBytes?: number | null;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function DownloadProgressModal({
  open,
  percent,
  title = "Downloading PDF...",
  subtitle = "Mohon tunggu, file sedang disiapkan.",
  loadedBytes = 0,
  totalBytes = null,
}: DownloadProgressModalProps) {
  if (!open) return null;

  const safePercent = clampPercent(percent);
  const safeLoadedBytes = Math.max(0, Math.floor(loadedBytes));
  const safeTotalBytes = totalBytes && totalBytes > 0 ? Math.floor(totalBytes) : null;

  function formatMB(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col items-center">
          <div className="relative h-28 w-28">
            <div className="absolute -inset-4 z-0 rounded-full border-[3px] border-sky-200 border-t-sky-600 animate-spin" />
            <div className="absolute -inset-7 z-0 rounded-full border-2 border-emerald-200 border-b-emerald-600 animate-[spin_2.6s_linear_infinite_reverse]" />
            <div className="absolute inset-0 z-10 overflow-hidden rounded-full border border-slate-200 bg-white p-2 shadow-inner">
              <img src="/azka.jpg" alt="Azka" className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="mt-5 text-center">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
          </div>

          <div className="mt-5 w-full">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 transition-all duration-300"
                style={{ width: `${safePercent}%` }}
              />
            </div>
            <div className="mt-2 text-center text-sm font-semibold text-slate-700">{safePercent}%</div>
            <div className="mt-2 text-center text-xs text-slate-500">
              {safeTotalBytes
                ? `${formatMB(safeLoadedBytes)} / ${formatMB(safeTotalBytes)}`
                : `${formatMB(safeLoadedBytes)} transferred`}
            </div>
            {safeTotalBytes ? (
              <div className="mt-1 text-center text-[11px] text-slate-400">
                Estimasi total: {formatMB(safeTotalBytes)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
