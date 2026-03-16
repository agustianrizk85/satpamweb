"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ActionMenuItem<K extends string = string> = {
  key: K;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

type ActionMenuProps<K extends string = string> = {
  items: readonly ActionMenuItem<K>[];
  triggerIcon?: ReactNode;
  triggerAriaLabel?: string;
  widthClassName?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
};

export default function ActionMenu<K extends string = string>({
  items,
  triggerIcon = <span className="text-lg leading-none">...</span>,
  triggerAriaLabel = "Actions",
  widthClassName = "w-44",
  triggerClassName = "",
  triggerStyle,
}: ActionMenuProps<K>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        left: rect.right,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const triggerWrap = wrapRef.current;
      const menuNode = menuRef.current;
      if (!triggerWrap || !open) return;
      if (e.target instanceof Node && (triggerWrap.contains(e.target) || Boolean(menuNode?.contains(e.target)))) return;
      setOpen(false);
    }

    function onEscape(e: KeyboardEvent) {
      if (open && e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${triggerClassName}`}
        style={triggerStyle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerAriaLabel}
      >
        {triggerIcon}
      </button>

      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className={`fixed z-[1000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md ${widthClassName}`}
              style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, transform: "translateX(-100%)" }}
              role="menu"
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    item.disabled ? "cursor-not-allowed text-slate-400" : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {item.icon ? <span>{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

