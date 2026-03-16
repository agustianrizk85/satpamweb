import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`app-glass-strong overflow-hidden rounded-[28px] p-6 shadow-[0_28px_65px_rgba(76,99,168,0.18)] ring-1 ring-white/70 ${className}`}
    >
      {children}
    </div>
  );
}
