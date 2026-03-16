"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

function Shell({
  open,
  onClose,
  topLabel,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  topLabel: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/70 bg-white/92 px-7 py-6 shadow-[0_34px_75px_rgba(15,23,42,0.34)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.16),transparent_36%)]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-slate-400 shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:bg-white hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <div className="mb-3 inline-flex rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            {topLabel}
          </div>
          <h2 className="text-[24px] font-semibold leading-snug tracking-[-0.02em] text-slate-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

type CrudAction = "create" | "edit" | "delete";

const cap = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

const makeTopLabel = ({
  moduleLabel,
  kind,
  action,
}: {
  moduleLabel?: string;
  kind: "Confirm" | "Success";
  action: CrudAction;
}) => {
  const moduleName = (moduleLabel ?? "").trim();
  const actionLabel = cap(action);
  return moduleName ? `${moduleName} - ${kind} ${actionLabel}` : `${kind} ${actionLabel}`;
};

const makeTopLabelError = ({
  moduleLabel,
  action,
}: {
  moduleLabel?: string;
  action: CrudAction;
}) => {
  const moduleName = (moduleLabel ?? "").trim();
  const actionLabel = cap(action);
  return moduleName ? `${moduleName} - Error ${actionLabel}` : `Error ${actionLabel}`;
};

export type ConfirmAction = CrudAction;

export type ConfirmModalPublicProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  moduleLabel?: string;
  action?: ConfirmAction;
  topLabel?: string;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function ConfirmModalMaster({
  open,
  onClose,
  onConfirm,
  moduleLabel,
  action = "create",
  topLabel,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmModalPublicProps) {
  return (
    <Shell open={open} onClose={onClose} topLabel={topLabel ?? makeTopLabel({ moduleLabel, kind: "Confirm", action })} title={title}>
      <div className="mt-3 text-sm leading-relaxed text-slate-600">{message}</div>

      <div className="mt-7 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-5 text-sm font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:bg-slate-50"
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-400/30 bg-[linear-gradient(135deg,#2563eb_0%,#7c3aed_58%,#ec4899_100%)] px-6 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(99,102,241,0.34)] hover:-translate-y-0.5"
        >
          {confirmLabel}
        </button>
      </div>
    </Shell>
  );
}

export type SuccessVariant = CrudAction;

export type SuccessModalPublicProps = {
  open: boolean;
  onClose: () => void;
  moduleLabel?: string;
  variant?: SuccessVariant;
  topLabel?: string;
  title: string;
  message: React.ReactNode;
  closeLabel?: string;
};

export function SuccessModalMaster({
  open,
  onClose,
  moduleLabel,
  variant = "create",
  topLabel,
  title,
  message,
  closeLabel = "Close",
}: SuccessModalPublicProps) {
  return (
    <Shell open={open} onClose={onClose} topLabel={topLabel ?? makeTopLabel({ moduleLabel, kind: "Success", action: variant })} title={title}>
      <div className="mt-5 flex justify-center">
        <div className="flex h-18 w-18 items-center justify-center rounded-full bg-emerald-50 shadow-[0_14px_28px_rgba(16,185,129,0.16)]">
          <Check className="h-9 w-9 text-emerald-500" />
        </div>
      </div>

      <div className="mt-4 whitespace-pre-line text-center text-sm leading-relaxed text-slate-700">{message}</div>

      <div className="mt-7">
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-sm font-semibold text-slate-800 shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:bg-slate-50"
        >
          {closeLabel}
        </button>
      </div>
    </Shell>
  );
}

export type ErrorVariant = CrudAction;

export type ErrorModalPublicProps = {
  open: boolean;
  onClose: () => void;
  moduleLabel?: string;
  variant?: ErrorVariant;
  topLabel?: string;
  title: string;
  message: React.ReactNode;
  closeLabel?: string;
};

export function ErrorModalMaster({
  open,
  onClose,
  moduleLabel,
  variant = "create",
  topLabel,
  title,
  message,
  closeLabel = "OK",
}: ErrorModalPublicProps) {
  return (
    <Shell open={open} onClose={onClose} topLabel={topLabel ?? makeTopLabelError({ moduleLabel, action: variant })} title={title}>
      <div className="mt-5 flex justify-center">
        <div className="flex h-18 w-18 items-center justify-center rounded-full bg-rose-50 shadow-[0_14px_28px_rgba(244,63,94,0.16)]">
          <X className="h-9 w-9 text-rose-500" />
        </div>
      </div>

      <div className="mt-4 whitespace-pre-line text-center text-sm leading-relaxed text-slate-700">{message}</div>

      <div className="mt-7">
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-sm font-semibold text-slate-800 shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:bg-slate-50"
        >
          {closeLabel}
        </button>
      </div>
    </Shell>
  );
}
