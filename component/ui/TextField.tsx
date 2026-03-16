import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function TextField({ label, className = "", ...props }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold tracking-[0.01em] text-slate-800">{label}</span>
      <input
        className={`w-full rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none placeholder:text-slate-400 focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15 ${className}`}
        {...props}
      />
    </label>
  );
}
