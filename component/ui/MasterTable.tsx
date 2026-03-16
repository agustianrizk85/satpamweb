"use client";

import { useMemo, useState, type ReactNode } from "react";

export type MasterTableColumn<TData> = {
  key: keyof TData | string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (row: TData) => ReactNode;
};

type MasterTableProps<TData> = {
  columns: readonly MasterTableColumn<TData>[];
  data: readonly TData[];
  className?: string;
  pageSizeOptions?: readonly number[];
  defaultPageSize?: number;
  showRowNumber?: boolean;
  rowNumberHeader?: string;
  serverPagination?: {
    page: number;
    pageSize: number;
    totalData: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  serverSorting?: {
    sortKey: string | null;
    sortDirection: "asc" | "desc";
    onSortChange: (sortKey: string, sortDirection: "asc" | "desc") => void;
  };
  disableClientSearch?: boolean;
  searchPlaceholder?: string;
  query?: string;
  onChangeQuery?: (value: string) => void;
  emptyMessage?: string;
  getRowKey?: (row: TData, index: number) => string;
};

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export default function MasterTable<TData>({
  columns,
  data,
  className = "",
  pageSizeOptions = [5, 10, 20, 50],
  defaultPageSize = 10,
  showRowNumber = true,
  rowNumberHeader = "No",
  serverPagination,
  serverSorting,
  disableClientSearch = false,
  searchPlaceholder = "Cari data tabel...",
  query,
  onChangeQuery,
  emptyMessage = "No data.",
  getRowKey,
}: MasterTableProps<TData>) {
  const controlledSearch = query !== undefined;
  const [internalQuery, setInternalQuery] = useState("");
  const searchQuery = controlledSearch ? query : internalQuery;
  const isServerPaging = Boolean(serverPagination);
  const isServerSorting = Boolean(serverSorting);

  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = useState<"asc" | "desc">("asc");
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);

  const activeSortKey = isServerSorting ? (serverSorting?.sortKey ?? null) : internalSortKey;
  const activeSortDirection = isServerSorting ? (serverSorting?.sortDirection ?? "asc") : internalSortDirection;

  const filteredData = useMemo(() => {
    if (disableClientSearch || (isServerPaging && !onChangeQuery)) return [...data];

    const q = searchQuery.trim().toLowerCase();
    if (!q) return [...data];

    return data.filter((row) =>
      columns.some((column) => {
        if (column.render) return false;
        const raw = (row as Record<string, unknown>)[String(column.key)];
        return stringifyValue(raw).toLowerCase().includes(q);
      }),
    );
  }, [columns, data, disableClientSearch, isServerPaging, onChangeQuery, searchQuery]);

  const sortedData = useMemo(() => {
    if (isServerSorting || !activeSortKey) return filteredData;

    const copied = [...filteredData];
    copied.sort((a, b) => {
      const rawA = (a as Record<string, unknown>)[activeSortKey];
      const rawB = (b as Record<string, unknown>)[activeSortKey];
      const valA = stringifyValue(rawA).toLowerCase();
      const valB = stringifyValue(rawB).toLowerCase();

      if (valA < valB) return activeSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return activeSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return copied;
  }, [activeSortDirection, activeSortKey, filteredData, isServerSorting]);

  const currentPage = isServerPaging
    ? Math.max(1, Math.min(serverPagination?.page ?? 1, Math.max(serverPagination?.totalPages ?? 1, 1)))
    : Math.min(internalPageIndex + 1, Math.max(1, Math.ceil(sortedData.length / internalPageSize)));
  const totalPages = isServerPaging ? Math.max(serverPagination?.totalPages ?? 1, 1) : Math.max(1, Math.ceil(sortedData.length / internalPageSize));
  const totalRows = isServerPaging ? Math.max(serverPagination?.totalData ?? 0, 0) : sortedData.length;
  const currentPageSize = isServerPaging ? Math.max(serverPagination?.pageSize ?? defaultPageSize, 1) : internalPageSize;
  const pagedData = isServerPaging
    ? sortedData
    : sortedData.slice((currentPage - 1) * currentPageSize, currentPage * currentPageSize);
  const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * currentPageSize;
  const endIndex = totalRows === 0 ? 0 : Math.min(startIndex + pagedData.length, totalRows);

  function handleToggleSort(column: MasterTableColumn<TData>) {
    if (!column.sortable) return;
    const key = String(column.key);
    const nextDirection: "asc" | "desc" =
      activeSortKey !== key ? "asc" : activeSortDirection === "asc" ? "desc" : "asc";

    if (isServerSorting) {
      serverSorting?.onSortChange(key, nextDirection);
      return;
    }

    if (internalSortKey !== key) {
      setInternalSortKey(key);
      setInternalSortDirection("asc");
      return;
    }
    setInternalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function handleSearch(value: string) {
    if (controlledSearch) onChangeQuery?.(value);
    else setInternalQuery(value);

    if (isServerPaging) {
      serverPagination?.onPageChange(1);
      return;
    }
    setInternalPageIndex(0);
  }

  function handleChangePageSize(next: number) {
    if (isServerPaging) {
      serverPagination?.onPageSizeChange(next);
      return;
    }
    setInternalPageSize(next);
    setInternalPageIndex(0);
  }

  function goPrevPage() {
    if (currentPage <= 1) return;
    if (isServerPaging) {
      serverPagination?.onPageChange(currentPage - 1);
      return;
    }
    setInternalPageIndex((prev) => Math.max(0, prev - 1));
  }

  function goNextPage() {
    if (currentPage >= totalPages) return;
    if (isServerPaging) {
      serverPagination?.onPageChange(currentPage + 1);
      return;
    }
    setInternalPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
  }

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {(!disableClientSearch && (!isServerPaging || Boolean(onChangeQuery)) && (onChangeQuery || !controlledSearch)) ? (
        <div className="app-glass flex flex-col gap-3 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(76,99,168,0.12)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Table explorer</div>
            <div className="text-xs text-slate-500">Cari data lebih cepat tanpa pindah halaman.</div>
          </div>
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full max-w-md rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm text-slate-800 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
          />
        </div>
      ) : null}

      <div className="app-glass overflow-visible rounded-[28px] shadow-[0_24px_55px_rgba(76,99,168,0.15)]">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-white/60 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(14,165,233,0.08)_45%,rgba(236,72,153,0.12))]">
                {showRowNumber ? (
                  <th className="w-16 px-3 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {rowNumberHeader}
                  </th>
                ) : null}
                {columns.map((column) => {
                  const columnKey = String(column.key);
                  const activeSort = activeSortKey === columnKey ? activeSortDirection : null;
                  return (
                    <th
                      key={columnKey}
                      className={`px-3 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 ${column.className ?? ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSort(column)}
                        className={`inline-flex items-center gap-1 ${
                          column.sortable ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {column.header}
                        {column.sortable ? (
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] text-slate-500 shadow-[0_6px_12px_rgba(15,23,42,0.06)]">
                            {activeSort === "asc" ? "ASC" : activeSort === "desc" ? "DESC" : "SORT"}
                          </span>
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-sm font-medium text-slate-500"
                    colSpan={columns.length + (showRowNumber ? 1 : 0)}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pagedData.map((row, index) => (
                  <tr
                    key={getRowKey ? getRowKey(row, index) : `${index}`}
                    className="border-b border-white/60 text-sm text-slate-800 last:border-b-0 odd:bg-white/70 even:bg-sky-50/30 hover:bg-cyan-50/55"
                  >
                    {showRowNumber ? (
                      <td className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
                        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-900/5 px-2 py-1">
                          {startIndex + index + 1}
                        </span>
                      </td>
                    ) : null}
                    {columns.map((column) => {
                      const key = String(column.key);
                      return (
                        <td key={key} className={`px-3 py-3 align-middle ${column.className ?? ""}`}>
                          {column.render ? column.render(row) : stringifyValue((row as Record<string, unknown>)[key])}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="app-glass flex flex-wrap items-center justify-between gap-3 rounded-[24px] px-4 py-3 text-xs text-slate-600 shadow-[0_18px_40px_rgba(76,99,168,0.12)]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/80 px-3 py-1 font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">Rows</span>
          <select
            value={currentPageSize}
            onChange={(e) => handleChangePageSize(Number(e.target.value))}
            className="rounded-xl border border-white/70 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-800"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="text-slate-500">
            {totalRows === 0 ? "0" : `${startIndex + 1}-${endIndex}`} of {totalRows}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevPage}
            disabled={currentPage <= 1}
            className="rounded-xl border border-white/70 bg-white/85 px-3 py-2 font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <span className="rounded-full bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(236,72,153,0.14))] px-3 py-1.5 font-semibold text-slate-800">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNextPage}
            disabled={currentPage >= totalPages}
            className="rounded-xl border border-white/70 bg-white/85 px-3 py-2 font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

