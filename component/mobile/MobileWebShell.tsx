"use client";

import * as React from "react";

type MobileWebShellProps = {
  children: React.ReactNode;
  contentClassName?: string;
};

function formatNowTime() {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MobileWebShell({ children, contentClassName = "bg-[#f3f6fb]" }: MobileWebShellProps) {
  const [timeText, setTimeText] = React.useState<string>(() => formatNowTime());

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setTimeText(formatNowTime());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-[100svh] bg-[#d8e4ff] p-0 sm:p-3">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden bg-white shadow-[0_16px_40px_rgba(15,23,42,0.2)] sm:rounded-[28px] sm:border sm:border-[#c8d4ef]">
        <div className="flex h-8 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="text-[12px] font-extrabold tracking-[0.2px] text-slate-800">{timeText}</div>
          <div className="flex items-end gap-[3px]">
            <span className="h-[5px] w-[2px] rounded bg-slate-600" />
            <span className="h-[8px] w-[2px] rounded bg-slate-600" />
            <span className="h-[11px] w-[2px] rounded bg-slate-600" />
            <span className="ml-1 inline-block h-[8px] w-[8px] rounded-full bg-sky-500" />
          </div>
        </div>

        <div className={`h-[calc(100svh-56px)] overflow-y-auto ${contentClassName}`}>{children}</div>

        <div className="flex h-6 items-center justify-center border-t border-slate-200 bg-white">
          <div className="h-1 w-24 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
}
