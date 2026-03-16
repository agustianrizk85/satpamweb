import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "border border-sky-400/30 bg-[linear-gradient(135deg,#2563eb_0%,#7c3aed_58%,#ec4899_100%)] text-white shadow-[0_18px_34px_rgba(99,102,241,0.34)] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(99,102,241,0.38)] focus:ring-sky-400/35 disabled:translate-y-0 disabled:opacity-60",
  secondary:
    "border border-white/70 bg-white/85 text-slate-800 shadow-[0_12px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)] focus:ring-slate-300/50 disabled:translate-y-0 disabled:opacity-60",
};

export default function Button({
  className = "",
  variant = "primary",
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-[13px] font-semibold tracking-[0.01em] transition duration-200 focus:outline-none focus:ring-2 ${variantClassName[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}
