"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeWord } from "@/lib/magic-words";
import { MAX_MAGIC_WORD_LEN } from "@/lib/constants";
import type { MagicWordEntry } from "@/lib/magic-words";

const AUTOSAVE_MS = 300;

function useRandomWord(entry: MagicWordEntry | undefined, onWordSave: (word: string) => void) {
  const [wordText, setWordText] = useState(entry?.word || "");
  const savedRef = useRef(entry?.word || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const w = entry?.word || "";
    if (w !== savedRef.current) {
      savedRef.current = w;
      setWordText(w);
    }
  }, [entry?.word]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleChange = useCallback(
    (v: string) => {
      setWordText(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const clean = sanitizeWord(v);
        if (clean === null) return;
        savedRef.current = clean;
        onWordSave(clean);
      }, AUTOSAVE_MS);
    },
    [onWordSave]
  );

  const handleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setWordText((prev) => (prev.trim() ? prev : savedRef.current));
  }, []);

  return { wordText, handleChange, handleBlur };
}

type Props = {
  name: string;
  entry: MagicWordEntry | undefined;
  onReroll: () => void;
  onWordSave: (word: string) => void;
};

const rerollBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm align-middle bg-surface border-default text-primary bg-surface-hover";

// The "—" fallback is purely defensive: every stored entry carries real
// parts, so this only renders for records that have none.
function displayEntry(entry: MagicWordEntry | undefined): MagicWordEntry | undefined {
  return entry && entry.parts.some((p) => p) ? entry : undefined;
}

export function RandomSpellRow({ name, entry, onReroll, onWordSave }: Props) {
  const { wordText, handleChange, handleBlur } = useRandomWord(entry, onWordSave);
  const shown = displayEntry(entry);
  return (
    <tr className="border-b border-default">
      <td className="py-2 px-2 text-sm font-medium whitespace-nowrap max-w-[9rem] truncate align-middle text-primary">
        {name}
      </td>
      <td className="py-2 px-2 text-sm whitespace-nowrap tabular-nums align-middle text-dim">
        {shown ? shown.rolls.join(" · ") : "—"}
      </td>
      <td className="py-2 px-2 text-sm whitespace-nowrap tabular-nums align-middle text-dim">
        {shown ? shown.parts.join(" · ") : "—"}
      </td>
      <td className="py-2 px-2 text-sm min-w-[10rem] max-w-[16rem] align-middle text-primary">
        <input
          aria-label={`Result for ${name}`}
          className="w-full h-8 rounded-md border px-2 text-[13px] focus:outline-none focus:ring-1 focus-ring-accent placeholder:text-[var(--text-dim)] input-field"
          value={wordText}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          maxLength={MAX_MAGIC_WORD_LEN}
          placeholder="—"
        />
      </td>
      <td className="py-2 px-1 w-[64px] min-w-[64px] max-w-[64px] whitespace-nowrap align-middle text-center">
        <button
          aria-label={`Re-roll magic word for ${name}`}
          className={rerollBtn}
          onClick={onReroll}
          type="button"
          title="Re-roll"
        >
          🎲
        </button>
      </td>
    </tr>
  );
}

export function RandomSpellCard({ name, entry, onReroll, onWordSave }: Props) {
  const { wordText, handleChange, handleBlur } = useRandomWord(entry, onWordSave);
  const shown = displayEntry(entry);
  return (
    <div className="flex flex-col gap-2 p-3 border bg-surface border-default">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-tight truncate text-primary">{name}</h3>
        <button
          aria-label={`Re-roll magic word for ${name} mobile`}
          className={`${rerollBtn} h-11 w-11 text-base`}
          onClick={onReroll}
          type="button"
          title="Re-roll"
        >
          🎲
        </button>
      </div>
      <div className="text-[12px] text-dim">
        {shown ? `Rolls: ${shown.rolls.join(" · ")} | ${shown.parts.join(" · ")}` : "—"}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest font-semibold text-dim">Result</span>
        <input
          aria-label={`Result for ${name} mobile`}
          className="w-full rounded-xl border px-3 text-[15px] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field"
          style={{ height: "44px" }}
          value={wordText}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          maxLength={MAX_MAGIC_WORD_LEN}
          placeholder="—"
        />
      </label>
    </div>
  );
}
