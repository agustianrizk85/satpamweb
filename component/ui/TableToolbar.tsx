"use client";

import type { ReactNode } from "react";
import Button from "./Button";

type TableToolbarProps = {
  query?: string;
  onChangeQuery?: (value: string) => void;
  onFilter?: () => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  className?: string;
  leftExtra?: ReactNode;
  rightExtra?: ReactNode;
  disableSearch?: boolean;
  disableFilter?: boolean;
  disableRefresh?: boolean;
  disableAdd?: boolean;
};

export default function TableToolbar({
  query = "",
  onChangeQuery,
  onFilter,
  onRefresh,
  onAdd,
  className = "",
  leftExtra,
  rightExtra,
  disableSearch = false,
  disableFilter = false,
  disableRefresh = false,
  disableAdd = false,
}: TableToolbarProps) {
  return (
    <div className={`mb-2 flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!disableSearch ? (
          <label className="flex h-9 items-center gap-2 rounded-xl bg-slate-100 px-3 ring-1 ring-slate-200">
            <span className="text-xs text-slate-500">Search</span>
            <input
              value={query}
              onChange={(e) => onChangeQuery?.(e.target.value)}
              placeholder="Search"
              className="h-8 w-[240px] bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500"
            />
          </label>
        ) : null}
        {!disableFilter ? (
          <Button type="button" variant="secondary" className="h-9 px-3" onClick={onFilter}>
            Filter
          </Button>
        ) : null}
        {leftExtra}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!disableRefresh ? (
          <Button type="button" variant="secondary" className="h-9 px-3" onClick={onRefresh}>
            Refresh
          </Button>
        ) : null}
        {!disableAdd ? (
          <Button type="button" className="h-9 px-4" onClick={onAdd}>
            Add
          </Button>
        ) : null}
        {rightExtra}
      </div>
    </div>
  );
}

