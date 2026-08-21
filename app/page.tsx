"use client";

import { useEffect, useMemo, useState } from "react";
import { SCHOOLS, getLangName, formatBox, parseBox } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { DesktopRow } from "@/components/DesktopRow";
import { MobileCard } from "@/components/MobileCard";

type Spell = {
  name: string;
  school: string;
};

type RowExtra = {
  box: string;
  targetLang: string;
  saving: boolean;
  status: string;
};

function useIsMobile(breakpoint = 880) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = () => setM(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
    q();
    window.addEventListener("resize", q);
    return () => window.removeEventListener("resize", q);
  }, [breakpoint]);
  return m;
}

export default function LabPage() {
  // Future: populated from D&D Beyond character linking
  const [spellsArr] = useState<Spell[]>([]);

  const grouped = useMemo(() => {
    const g: Record<string, Spell[]> = {};
    for (const s of SCHOOLS) g[s] = [];
    for (const sp of spellsArr) {
      if (!sp?.school) continue;
      if (!g[sp.school]) g[sp.school] = [];
      g[sp.school].push(sp);
    }
    for (const s of Object.keys(g)) {
      g[s].sort((a, b) => a.name.localeCompare(b.name));
    }
    return g;
  }, [spellsArr]);

  const isMobile = useIsMobile(880);
  const [activeSchool, setActiveSchool] = useState<School>("Evocation");
  const [extras, setExtras] = useState<Record<string, RowExtra>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dnd-chant-extras-v1");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, RowExtra>;
        setExtras(parsed);
      }
    } catch {}
  }, []);

  const persist = (next: Record<string, RowExtra>) => {
    try {
      localStorage.setItem("dnd-chant-extras-v1", JSON.stringify(next));
    } catch {}
  };

  const ensureRow = (spellName: string): RowExtra => {
    const existing = extras[spellName];
    if (existing) return existing;
    return { box: "", targetLang: "en", saving: false, status: "" };
  };

  const setRow = (name: string, patch: Partial<RowExtra>) => {
    setExtras((prev) => {
      const cur = prev[name] ?? ensureRow(name);
      const nextRow = { ...cur, ...patch };
      const next = { ...prev, [name]: nextRow };
      persist(next);
      return next;
    });
  };

  const onTranslate = async (name: string) => {
    const row = extras[name] ?? ensureRow(name);
    const sp = spellsArr.find((x) => x.name === name);
    if (!sp) return;
    setRow(name, { saving: false, status: "translate..." });
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sp.name, source: "en", target: row.targetLang }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const translated = (j.translated as string) || "";
      const romanized = (j.romanized as string) || "";
      const box = formatBox(translated, romanized);
      setRow(name, { box, status: "ok" });
      setTimeout(() => setRow(name, { status: "" }), 1500);
    } catch (e: any) {
      setRow(name, { status: `err ${String(e?.message || e).slice(0, 80)}` });
    }
  };

  const onTrySave = async (name: string) => {
    const row = extras[name] ?? ensureRow(name);
    setRow(name, { saving: true, status: "save..." });
    try {
      const { native, roman } = parseBox(row.box);
      setRow(name, { saving: false, status: `saved ${native.slice(0, 12)}${roman ? " [" + roman.slice(0, 10) + "]" : ""}` });
      setTimeout(() => setRow(name, { status: "" }), 1800);
    } catch (e: any) {
      setRow(name, { saving: false, status: `err ${String(e?.message || e).slice(0, 70)}` });
    }
  };

  const totalVerbal = spellsArr.length;
  const activeSpells = grouped[activeSchool] || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {SCHOOLS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSchool(s as School)}
              className={`btn ${activeSchool === s ? "" : "btn-ghost"} text-sm`}
            >
              {s} {grouped[s]?.length ? `· ${grouped[s].length}` : ""}
            </button>
          ))}
        </div>
        <div className="text-xs text-[var(--dim)]">{totalVerbal} spells</div>
      </div>

      {totalVerbal === 0 ? (
        <div className="card px-6 py-12 text-center space-y-3">
          <div className="text-lg font-semibold">No spells yet</div>
          <div className="text-sm text-[var(--dim)] max-w-[420px] mx-auto">
            Link your D&amp;D Beyond character to see your spells here. Spells will be generated per-character when you link a sheet – there&apos;s no static list.
          </div>
          <div className="text-xs text-[var(--dim)] pt-2">Future: paste D&amp;D Beyond URL or upload JSON to populate spells by school.</div>
        </div>
      ) : isMobile ? (
        <div className="grid grid-cols-1 gap-3">
          {activeSpells.map((sp) => {
            const row = extras[sp.name] ?? ensureRow(sp.name);
            return (
              <MobileCard
                key={sp.name}
                spellName={sp.name}
                school={sp.school}
                box={row.box}
                targetLang={row.targetLang}
                status={row.status}
                saving={row.saving}
                onBoxChange={(v) => setRow(sp.name, { box: v })}
                onLangChange={(v) => setRow(sp.name, { targetLang: v })}
                onTranslate={() => onTranslate(sp.name)}
                onTrySave={() => onTrySave(sp.name)}
                onAudio={() => {
                  const { native } = parseBox(row.box);
                  const t = native.trim();
                  if (!t) return;
                  const tl = row.targetLang;
                  const url = `/api/tts?text=${encodeURIComponent(t)}&target=${encodeURIComponent(tl)}`;
                  const a = new Audio(url);
                  a.play().catch(() => {});
                }}
                onIdiom={() => {
                  const langName = getLangName(row.targetLang);
                  const tryText = (parseBox(row.box).native || sp.name).trim();
                  window.open("https://www.google.com/search?q=" + encodeURIComponent(`idiom in ${langName} for "${tryText}"`), "_blank");
                }}
              />
            );
          })}
          {activeSpells.length === 0 ? (
            <div className="text-sm text-[var(--dim)] text-center py-8">No spells in {activeSchool}. Link a character to populate.</div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[160px_1fr_260px_92px] gap-2 px-2 text-[11px] text-[var(--dim)] uppercase tracking-wide">
            <div>Spell</div><div>Chant box</div><div>Translate</div><div>Actions</div>
          </div>
          {activeSpells.map((sp) => {
            const row = extras[sp.name] ?? ensureRow(sp.name);
            return (
              <DesktopRow
                key={sp.name}
                spellName={sp.name}
                box={row.box}
                targetLang={row.targetLang}
                status={row.status}
                onBoxChange={(v) => setRow(sp.name, { box: v })}
                onLangChange={(v) => setRow(sp.name, { targetLang: v })}
                onTranslate={() => onTranslate(sp.name)}
                onTrySave={() => onTrySave(sp.name)}
                onAudio={() => {
                  const { native } = parseBox(row.box);
                  const t = native.trim();
                  if (!t) return;
                  const tl = row.targetLang;
                  const url = `/api/tts?text=${encodeURIComponent(t)}&target=${encodeURIComponent(tl)}`;
                  const a = new Audio(url);
                  a.play().catch(() => {});
                }}
                onIdiom={() => {
                  const langName = getLangName(row.targetLang);
                  const tryText = (parseBox(row.box).native || sp.name).trim();
                  window.open("https://www.google.com/search?q=" + encodeURIComponent(`idiom in ${langName} for "${tryText}"`), "_blank");
                }}
              />
            );
          })}
          {activeSpells.length === 0 ? (
            <div className="text-sm text-[var(--dim)] text-center py-12">No spells in {activeSchool}. Link a character to populate.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
