import type { ReactNode } from "react";

type ShellProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
};

export default function Shell({ sidebar, header, children }: ShellProps) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto min-h-dvh max-w-[1800px] md:grid md:grid-cols-[280px_1fr] md:grid-rows-[auto_1fr] md:gap-0 md:p-5">
        <aside className="md:sticky md:top-5 md:z-30 md:row-span-2 md:h-[calc(100dvh-2.5rem)]">{sidebar}</aside>

        {header ? (
          <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 md:top-5 md:col-start-2 md:row-start-1 md:px-0 md:pt-0">
            <div className="overflow-hidden rounded-[28px] bg-[rgba(255,255,255,0.82)] shadow-[0_20px_44px_rgba(148,163,184,0.22)] backdrop-blur-xl md:rounded-none md:bg-transparent md:shadow-none md:backdrop-blur-none">
              {header}
            </div>
          </header>
        ) : null}

        <main className="min-w-0 px-3 pt-3 pb-6 sm:px-5 md:col-start-2 md:row-start-2 md:px-6 md:pt-6 lg:px-7">
          <div className="mx-auto w-full max-w-[1540px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
