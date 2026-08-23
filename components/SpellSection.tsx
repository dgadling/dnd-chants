"use client";
import { LANG_OPTIONS, getLangOptionDisplay, parseBox, formatBox } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { DesktopRow } from "@/components/DesktopRow";
import { MobileCard } from "@/components/MobileCard";

type Spell = { name: string; school: string };
type RowExtra = { englishPhrase: string; box: string };

const SCHOOL_DESCS: Record<string, string> = {
  Abjuration: "Protecting stuff",
  Conjuration: "Making stuff",
  Divination: "Knowing stuff",
  Enchantment: "Convincing stuff",
  Evocation: "Making energy stuff",
  Illusion: "Tricking stuff",
  Necromancy: "Dead stuff",
  Transmutation: "Changing stuff",
};

type Props = {
  activeSchool: School;
  activeSpells: Spell[];
  activeTargetLang: string;
  activeId: string;
  activeExtras: Record<string, RowExtra>;
  setSchoolLangsPerChar: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  helpTemplate: string;
  handleSave: (spellName: string, englishPhrase: string, native: string, roman: string) => void;
};

export function SpellSection({
  activeSchool,
  activeSpells,
  activeTargetLang,
  activeId,
  activeExtras,
  setSchoolLangsPerChar,
  helpTemplate,
  handleSave,
}: Props) {
  return (
    <section className="mb-5 md:mb-8 rounded-[14px] md:rounded-xl border overflow-hidden bg-surface border-default">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 px-3 py-3 md:px-4 border-b border-default bg-surface">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] md:text-lg font-semibold">
            <span className="text-accent">{activeSchool}</span>
            <span className="font-normal text-dim"> - {SCHOOL_DESCS[activeSchool]}</span>
          </h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border bg-surface border-default text-dim">
            {activeSpells.length}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm w-full md:w-auto">
          <span className="text-xs md:text-sm shrink-0 text-dim">Language</span>
          <select
            aria-label={`Language for ${activeSchool}`}
            className="flex-1 md:flex-none rounded-lg md:rounded-md border px-2.5 py-2.5 md:py-1.5 text-[14px] md:text-sm max-w-none md:max-w-[14rem] focus:outline-none focus:ring-2 focus-ring-accent select-lang"
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              borderColor: "var(--border)",
            } as React.CSSProperties}
            value={activeTargetLang}
            onChange={(e) => {
              if (!activeId) return;
              const v = e.target.value;
              setSchoolLangsPerChar((prev) => ({
                ...prev,
                [activeId]: { ...(prev[activeId] || {}), [activeSchool]: v },
              }));
            }}
          >
            {LANG_OPTIONS.map((o) => (
              <option key={`${o.code}-${o.label}`} value={o.code}>
                {getLangOptionDisplay(o)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wide border-b text-dim border-default bg-surface">
              <th className="py-2 px-2 font-medium align-middle">Spell</th>
              <th className="py-2 px-2 font-medium align-middle">Try phrasing</th>
              <th className="py-2 px-1 font-medium align-middle text-center">Go</th>
              <th className="py-2 px-2 font-medium align-middle">Result</th>
              <th className="py-2 px-1 font-medium w-[88px] min-w-[88px] max-w-[88px] whitespace-nowrap text-center align-middle">Audio / Help</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:align-middle">
            {activeSpells.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-dim">
                  No spells in {activeSchool}. Link a character to populate.
                </td>
              </tr>
            ) : (
              activeSpells.map((sp) => {
                const extra = activeExtras[sp.name];
                const tryDefault = extra?.englishPhrase || sp.name;
                const parsed = extra?.box ? parseBox(extra.box) : { native: "", roman: "" };
                return (
                  <DesktopRow
                    key={`d-${activeId}-${activeSchool}-${sp.name}-${activeTargetLang}`}
                    spell={sp}
                    targetLang={activeTargetLang}
                    school={activeSchool}
                    initialInput={tryDefault}
                    initialNative={parsed.native}
                    initialRoman={parsed.roman}
                    onSave={(en, nat, rom) => handleSave(sp.name, en, nat, rom)}
                    helpTemplate={helpTemplate}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-[var(--border)] bg-surface">
        {activeSpells.length === 0 ? (
          <div className="p-8 text-center text-sm text-dim">No spells in {activeSchool}. Link a character to populate.</div>
        ) : (
          activeSpells.map((sp) => {
            const extra = activeExtras[sp.name];
            const tryDefault = extra?.englishPhrase || sp.name;
            const parsed = extra?.box ? parseBox(extra.box) : { native: "", roman: "" };
            return (
              <MobileCard
                key={`m-${activeId}-${activeSchool}-${sp.name}-${activeTargetLang}`}
                spell={sp}
                targetLang={activeTargetLang}
                school={activeSchool}
                initialInput={tryDefault}
                initialNative={parsed.native}
                initialRoman={parsed.roman}
                onSave={(en, nat, rom) => handleSave(sp.name, en, nat, rom)}
                helpTemplate={helpTemplate}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
