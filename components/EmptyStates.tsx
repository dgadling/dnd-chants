"use client";
export function GetStarted({ onAddCharacter }: { onAddCharacter: () => void }) {
  return (
    <div className="rounded-xl border p-6 md:p-8 bg-surface border-default">
      <h2 className="text-[18px] font-semibold tracking-tight mb-1">Get started</h2>
      <p className="text-[13px] mb-6 max-w-[520px] text-dim">Link a character, pick a spell, write a cue. Everything saves locally.</p>
      <div className="flex gap-2">
        <button onClick={onAddCharacter} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold btn-accent">+ Add Character</button>
      </div>
    </div>
  );
}

export function NoSpellsEmpty() {
  return (
    <div className="px-6 py-12 text-center space-y-3 rounded-xl border bg-surface border-default">
      <div className="text-lg font-semibold">No spells yet</div>
      <div className="text-sm max-w-[420px] mx-auto text-dim">Link your D&D Beyond character from the left drawer.</div>
    </div>
  );
}

export function NoMatchEmpty({ filterText, clearFilter }: { filterText: string; clearFilter: () => void }) {
  return (
    <div className="rounded-xl border p-8 text-center bg-surface border-default">
      <div className="text-sm font-medium">No spells match “{filterText.trim()}”</div>
      <button onClick={clearFilter} className="mt-3 text-xs underline text-dim">Clear filter</button>
    </div>
  );
}
