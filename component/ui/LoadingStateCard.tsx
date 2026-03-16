"use client";
/* eslint-disable @next/next/no-img-element */

type LoadingStateCardProps = {
  title?: string;
  subtitle?: string;
};

export default function LoadingStateCard({
  title = "Loading...",
  subtitle = "Mohon tunggu, data sedang disiapkan.",
}: LoadingStateCardProps) {
  return (
    <div className="app-glass rounded-[24px] px-5 py-8 text-slate-700 shadow-[0_16px_34px_rgba(76,99,168,0.12)]">
      <style jsx>{`
        @keyframes loading-ring-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes loading-ring-spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes loading-logo-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center text-center">
        <div className="relative h-24 w-24">
          <div
            className="absolute -inset-4 z-0 rounded-full border-[3px]"
            style={{
              borderColor: "#dbeafe",
              borderTopColor: "#0284c7",
              animation: "loading-ring-spin 1s linear infinite",
            }}
          />
          <div
            className="absolute -inset-7 z-0 rounded-full border-2"
            style={{
              borderColor: "#d1fae5",
              borderBottomColor: "#059669",
              animation: "loading-ring-spin-reverse 2.6s linear infinite",
            }}
          />
          <div
            className="absolute inset-0 z-10 overflow-hidden rounded-full border border-slate-200 bg-white p-2 shadow-inner"
            style={{ animation: "loading-logo-pulse 1.8s ease-in-out infinite" }}
          >
            <img src="/azka.jpg" alt="Azka" className="h-full w-full object-contain" />
          </div>
        </div>

        <div className="mt-5 text-base font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}
