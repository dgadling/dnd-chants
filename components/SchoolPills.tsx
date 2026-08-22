"use client";
import { SCHOOLS } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { useTheme } from "@/lib/useTheme";

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
  grouped: Record<string, any[]>;
  activeSchool: School;
  setActiveSchool: (s: School) => void;
  hasChars: boolean;
};

export function SchoolPills({ grouped, activeSchool, setActiveSchool, hasChars }: Props) {
  const theme = useTheme();
  const isLight = theme.actual === "light";

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {SCHOOLS.map((s) => {
        const count = grouped[s]?.length || 0;
        const isActive = hasChars && activeSchool === s;
        if (isActive) {
          return (
            <button
              key={s}
              onClick={() => setActiveSchool(s as School)}
              className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors accent-pill`}
              title={`${s} - ${SCHOOL_DESCS[s]} (${count} spells)`}
            >
              {count > 0 ? `${s} · ${count}` : `${s} · 0`}
            </button>
          );
        }
        if (count === 0) {
          return (
            <button
              key={s}
              onClick={() => setActiveSchool(s as School)}
              className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors opacity-60 hover:opacity-80 ${isLight ? "bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-500" : "bg-zinc-800 text-zinc-500 border-zinc-700/60 hover:bg-zinc-700 hover:text-zinc-400"}`}
              title={`${s} - ${SCHOOL_DESCS[s]} (no spells)`}
            >
              {`${s} · 0`}
            </button>
          );
        }
        return (
          <button
            key={s}
            onClick={() => setActiveSchool(s as School)}
            className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors ${isLight ? "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50" : "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"}`}
            title={`${s} - ${SCHOOL_DESCS[s]} (${count} spells)`}
          >
            {`${s} · ${count}`}
          </button>
        );
      })}
    </div>
  );
}

export { SCHOOL_DESCS };
