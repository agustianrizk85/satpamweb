"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

type DateHighlightFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  availableDates?: string[];
  onVisibleMonthChange?: (monthKey: string) => void;
};

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const YEAR_RANGE = 10;

function parseDateOnly(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthGrid(monthBase: Date) {
  const firstDay = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1, 12, 0, 0, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatDisplayDate(value: string) {
  const parsed = parseDateOnly(value);
  if (!parsed) return "";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function DateHighlightField({
  label,
  value,
  onChange,
  min,
  max,
  availableDates = [],
  onVisibleMonthChange,
}: DateHighlightFieldProps) {
  const rootRef = React.useRef<HTMLLabelElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popupRef = React.useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [popupStyle, setPopupStyle] = React.useState<React.CSSProperties>({});
  const availableDateSet = React.useMemo(() => new Set(availableDates), [availableDates]);
  const parsedValue = React.useMemo(() => parseDateOnly(value), [value]);
  const minDate = React.useMemo(() => parseDateOnly(min), [min]);
  const maxDate = React.useMemo(() => parseDateOnly(max), [max]);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => parsedValue ?? maxDate ?? minDate ?? new Date());

  React.useEffect(() => {
    if (!isOpen) return;
    onVisibleMonthChange?.(toMonthKey(visibleMonth));
  }, [isOpen, onVisibleMonthChange, visibleMonth]);

  React.useEffect(() => {
    if (!parsedValue) return;
    setVisibleMonth(new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1, 12, 0, 0, 0));
  }, [parsedValue]);

  React.useEffect(() => {
    if (!isOpen) return;

    const updatePopupPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const popupWidth = 290;
      const viewportWidth = window.innerWidth;
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, viewportWidth - popupWidth - 12),
      );

      setPopupStyle({
        top: rect.bottom + 8,
        left,
        width: popupWidth,
      });
    };

    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [isOpen]);

  const days = React.useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const yearOptions = React.useMemo(() => {
    const anchorYears = [parsedValue?.getFullYear(), minDate?.getFullYear(), maxDate?.getFullYear(), new Date().getFullYear()]
      .filter((year): year is number => Number.isFinite(year));
    const minYear = Math.min(...anchorYears) - YEAR_RANGE;
    const maxYear = Math.max(...anchorYears) + YEAR_RANGE;
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [maxDate, minDate, parsedValue]);
  const canGoPrev = React.useMemo(() => {
    if (!minDate) return true;
    const prevMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1, 12, 0, 0, 0);
    return prevMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1, 12, 0, 0, 0);
  }, [minDate, visibleMonth]);
  const canGoNext = React.useMemo(() => {
    if (!maxDate) return true;
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 12, 0, 0, 0);
    return nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1, 12, 0, 0, 0);
  }, [maxDate, visibleMonth]);

  return (
    <label className="relative block" ref={rootRef}>
      <span className="mb-1 block text-[13px] font-medium text-slate-800">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-white/70 bg-white/85 px-3.5 py-3 text-left text-[13px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none focus:border-sky-400/60 focus:bg-white focus:ring-4 focus:ring-sky-400/15"
      >
        <span>{value ? formatDisplayDate(value) : "Pilih tanggal"}</span>
        <Calendar className="h-4 w-4 text-slate-500" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[1400]" aria-hidden="true">
          <button
            type="button"
            aria-label="Close calendar"
            className="absolute inset-0 block bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={popupRef}
            style={popupStyle}
            className="absolute rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => canGoPrev && setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1, 12, 0, 0, 0))}
                disabled={!canGoPrev}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <select
                  value={visibleMonth.getMonth()}
                  onChange={(event) =>
                    setVisibleMonth(
                      new Date(
                        visibleMonth.getFullYear(),
                        Number.parseInt(event.target.value, 10),
                        1,
                        12,
                        0,
                        0,
                        0,
                      ),
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-900"
                >
                  {MONTH_NAMES.map((monthName, index) => (
                    <option key={monthName} value={index}>
                      {monthName}
                    </option>
                  ))}
                </select>
                <select
                  value={visibleMonth.getFullYear()}
                  onChange={(event) =>
                    setVisibleMonth(
                      new Date(
                        Number.parseInt(event.target.value, 10),
                        visibleMonth.getMonth(),
                        1,
                        12,
                        0,
                        0,
                        0,
                      ),
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-900"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => canGoNext && setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 12, 0, 0, 0))}
                disabled={!canGoNext}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
              {DAY_NAMES.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dateKey = toDateOnly(day);
                const inMonth = day.getMonth() === visibleMonth.getMonth();
                const isSelected = value === dateKey;
                const isAvailable = availableDateSet.size === 0 ? true : availableDateSet.has(dateKey);
                const beforeMin = Boolean(minDate && day < minDate);
                const afterMax = Boolean(maxDate && day > maxDate);
                const disabled = !inMonth || beforeMin || afterMax || !isAvailable;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(dateKey);
                      setIsOpen(false);
                    }}
                    className={[
                      "relative h-9 rounded-lg text-sm font-semibold transition",
                      isSelected ? "bg-blue-600 text-white" : disabled ? "text-slate-300" : "text-slate-800 hover:bg-slate-100",
                      !isSelected && isAvailable && inMonth ? "bg-emerald-50" : "",
                    ].join(" ")}
                  >
                    {day.getDate()}
                    {!isSelected && isAvailable && inMonth ? <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </label>
  );
}
