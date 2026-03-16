import type { MenuLeafItem } from "./SidebarMenu";

type TabsProps<T extends string> = {
  items: readonly MenuLeafItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
};

export default function Tabs<T extends string>({ items, activeKey, onChange }: TabsProps<T>) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
            aria-pressed={active}
          >
            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
