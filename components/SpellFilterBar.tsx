"use client";
import { useEffect } from "react";

type Props = {
  filterText: string;
  setFilterText: (s: string) => void;
  clearFilter: () => void;
};

export function SpellFilterBar({ filterText, setFilterText, clearFilter }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("spell-filter-input") as HTMLInputElement | null;
        if (el) el.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative max-w-[480px]">
      <input
        id="spell-filter-input"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { if (filterText) setFilterText(""); else (e.target as HTMLInputElement).blur(); } }}
        placeholder="Filter spells…"
        className="w-full h-10 rounded-lg border pl-9 pr-9 text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim">⌕</span>
      {filterText ? (
        <button onClick={clearFilter} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-dim bg-surface-hover hover:text-primary" aria-label="Clear filter">✕</button>
      ) : null}
    </div>
  );
}
