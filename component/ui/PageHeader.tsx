"use client";

import type { ReactNode } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  onBack?: () => void;
  className?: string;
};

export default function PageHeader({ title, description, actions, onBack, className = "" }: PageHeaderProps) {
  return (
    <div
      className={`app-glass relative mb-5 overflow-hidden rounded-[28px] px-5 py-5 shadow-[0_24px_55px_rgba(76,99,168,0.16)] sm:px-6 ${className}`}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-52 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_58%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.18),transparent_56%)]" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/85 text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:bg-white"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-[0_10px_20px_rgba(14,165,233,0.1)]">
              <Sparkles className="h-3.5 w-3.5" />
              Admin workspace
            </div>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[30px]">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">{description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">Lebih cepat dipindai</span>
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">Visual lebih jelas</span>
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">Aksi utama lebih menonjol</span>
            </div>
          </div>
        </div>

        {actions ? <div className="relative shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

