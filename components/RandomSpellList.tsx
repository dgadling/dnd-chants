"use client";
import { useCallback, useMemo } from "react";
import { SCHOOLS, SCHOOL_DESCS } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { RandomSpellRow, RandomSpellCard } from "@/components/RandomSpellRow";
import { rollMagicWord, generateMissingWords, randomColumnWidths } from "@/lib/magic-words";
import type { MagicWordEntry } from "@/lib/magic-words";

type Props = {
  filteredGrouped: Record<string, any[]>;
  grouped: Record<string, any[]>;
  hasFilter: boolean;
  activeId: string;
  activeRandom: Record<string, MagicWordEntry>;
  setRandomPerChar: React.Dispatch<React.SetStateAction<Record<string, Record<string, MagicWordEntry>>>>;
  tableId: string;
};

export function RandomSpellList({
  filteredGrouped,
  grouped,
  hasFilter,
  activeId,
  activeRandom,
  setRandomPerChar,
  tableId,
}: Props) {
  const handleGenerateAll = useCallback(
    (spells: any[]) => {
      if (!activeId) return;
      setRandomPerChar((prev) => {
        const next = generateMissingWords(prev[activeId] || {}, spells.map((s) => s.name), tableId);
        return { ...prev, [activeId]: next };
      });
    },
    [activeId, setRandomPerChar, tableId]
  );

  const handleReroll = useCallback(
    (spellName: string) => {
      if (!activeId) return;
      const entry = rollMagicWord(tableId);
      setRandomPerChar((prev) => ({
        ...prev,
        [activeId]: { ...(prev[activeId] || {}), [spellName]: entry },
      }));
    },
    [activeId, setRandomPerChar, tableId]
  );

  const handleWordSave = useCallback(
    (spellName: string, word: string) => {
      if (!activeId) return;
      setRandomPerChar((prev) => {
        const cur = (prev[activeId] || {})[spellName];
        if (cur && cur.word === word) return prev;
        const entry: MagicWordEntry = cur
          ? { ...cur, word }
          : { ...rollMagicWord(tableId), word };
        return {
          ...prev,
          [activeId]: { ...(prev[activeId] || {}), [spellName]: entry },
        };
      });
    },
    [activeId, setRandomPerChar, tableId]
  );

  // Fixed column widths (ch) sized to the longest displayable content so the
  // Rolls/Parts columns never shift as rows re-render with different values.
  const colWidths = useMemo(() => randomColumnWidths(tableId), [tableId]);

  return (
    <div className="flex flex-col gap-5">
      {SCHOOLS.map((school) => {
        const spells = filteredGrouped[school] || [];
        if (hasFilter && spells.length === 0) return null;
        if (!hasFilter && (grouped[school]?.length || 0) === 0 && spells.length === 0) return null;
        return (
          <section
            key={school}
            className="mb-5 md:mb-8 rounded-[14px] md:rounded-xl border overflow-hidden bg-surface border-default"
          >
            <div className="flex items-center justify-between gap-2 md:gap-3 px-3 py-3 md:px-4 border-b border-default bg-surface">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[16px] md:text-lg font-semibold truncate">
                  <span className="text-accent">{school as School}</span>
                  <span className="font-normal text-dim"> - {SCHOOL_DESCS[school]}</span>
                </h2>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full border bg-surface border-default text-dim">
                  {spells.length}
                </span>
              </div>
              <button
                onClick={() => handleGenerateAll(spells)}
                type="button"
                className="shrink-0 text-[12px] md:text-[13px] px-3 py-2 rounded-lg border font-medium bg-surface border-default text-primary bg-surface-hover"
              >
                Generate all
              </button>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col />
                  <col style={{ width: `${colWidths.rolls}ch` }} />
                  <col style={{ width: `${colWidths.parts}ch` }} />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr className="text-xs uppercase tracking-wide border-b text-dim border-default bg-surface">
                    <th className="py-2 px-2 font-medium align-middle">Spell</th>
                    <th className="py-2 px-2 font-medium align-middle">Rolls</th>
                    <th className="py-2 px-2 font-medium align-middle">Parts</th>
                    <th className="py-2 px-2 font-medium align-middle">Result</th>
                    <th className="py-2 px-1 font-medium w-[64px] min-w-[64px] max-w-[64px] whitespace-nowrap text-center align-middle">Re-roll</th>
                  </tr>
                </thead>
                <tbody className="[&>tr>td]:align-middle">
                  {spells.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-dim">
                        No spells in {school}. Link a character to populate.
                      </td>
                    </tr>
                  ) : (
                    spells.map((sp: any) => (
                      <RandomSpellRow
                        key={`r-${activeId}-${school}-${sp.name}`}
                        name={sp.name}
                        entry={activeRandom[sp.name]}
                        onReroll={() => handleReroll(sp.name)}
                        onWordSave={(word) => handleWordSave(sp.name, word)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-[var(--border)] bg-surface">
              {spells.length === 0 ? (
                <div className="p-8 text-center text-sm text-dim">No spells in {school}. Link a character to populate.</div>
              ) : (
                spells.map((sp: any) => (
                  <RandomSpellCard
                    key={`rc-${activeId}-${school}-${sp.name}`}
                    name={sp.name}
                    entry={activeRandom[sp.name]}
                    onReroll={() => handleReroll(sp.name)}
                    onWordSave={(word) => handleWordSave(sp.name, word)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
