import type { InputHTMLAttributes } from "react";

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export default function CheckboxField({ label, className = "", ...props }: CheckboxFieldProps) {
  return (
    <label className="inline-flex select-none items-center gap-2.5 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        className={`h-4.5 w-4.5 rounded border-slate-300/80 text-sky-600 focus:ring-sky-500/30 ${className}`}
        {...props}
      />
      {label}
    </label>
  );
}
