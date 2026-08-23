"use client";
import { SCHOOLS, SCHOOL_DEFAULTS } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { SpellSection } from "@/components/SpellSection";

type Props = {
  filteredGrouped: Record<string, any[]>;
  grouped: Record<string, any[]>;
  hasFilter: boolean;
  activeId: string;
  activeLangs: Record<string, string>;
  activeExtras: Record<string, { englishPhrase: string; box: string }>;
  setSchoolLangsPerChar: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  helpTemplate: string;
  handleSave: (spellName: string, englishPhrase: string, native: string, roman: string) => void;
};

export function SpellList({
  filteredGrouped,
  grouped,
  hasFilter,
  activeId,
  activeLangs,
  activeExtras,
  setSchoolLangsPerChar,
  helpTemplate,
  handleSave,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      {SCHOOLS.map((school) => {
        const spells = filteredGrouped[school] || [];
        if (hasFilter && spells.length === 0) return null;
        if (!hasFilter && (grouped[school]?.length || 0) === 0 && spells.length === 0) return null;
        const targetLang = activeLangs[school] || (SCHOOL_DEFAULTS[school as School] as string) || "en";
        return (
          <SpellSection
            key={school}
            activeSchool={school as School}
            activeSpells={spells as any}
            activeTargetLang={targetLang}
            activeId={activeId}
            activeExtras={activeExtras as any}
            setSchoolLangsPerChar={setSchoolLangsPerChar}
            helpTemplate={helpTemplate}
            handleSave={handleSave}
          />
        );
      })}
    </div>
  );
}
