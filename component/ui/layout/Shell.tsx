"use client";

import * as React from "react";

type ShellProps = {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
};

export default function Shell({ sidebar, header, children }: ShellProps) {
  return (
    <div className="flex h-dvh w-dvw overflow-hidden bg-neutral-50">
      <aside className="shrink-0 border-r border-neutral-200 bg-white">{sidebar}</aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {header && (
          <div className="sticky top-0 z-20 w-full border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="w-full max-w-none px-0">{header}</div>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full max-w-none px-0">{children}</div>
        </main>
      </section>
    </div>
  );
}
