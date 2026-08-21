"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS, SCHOOL_DEFAULTS, LANG_OPTIONS, getLangName, getLangOptionDisplay, formatBox, parseBox } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { playCachedAudio } from "@/lib/audio";
import { DesktopRow } from "@/components/DesktopRow";
import { MobileCard } from "@/components/MobileCard";

type Spell = {
  name: string;
  school: string;
};

type RowExtra = {
  englishPhrase: string;
  box: string;
  saving: boolean;
  status: string;
};

type DdbLink = {
  characterId: string;
  characterName: string;
  lastFetchISO: string;
  lastModifiedISO?: string | null;
  spells: Spell[];
};

const STORAGE_LINK = "dnd-chant-ddb-link-v1";
const STORAGE_EXTRAS = "dnd-chant-extras-v1";
const STORAGE_SCHOOL_LANGS = "dnd-chant-school-langs-v1";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

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

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = now - then;
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function extractIdForDisplay(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/characters\/(\d{2,})/i);
  if (m) return m[1];
  const m2 = s.match(/(\d{5,})/);
  if (m2) return m2[1];
  return null;
}

export default function LabPage() {
  const [spellsArr, setSpellsArr] = useState<Spell[]>([]);
  const [characterId, setCharacterId] = useState<string>("");
  const [characterName, setCharacterName] = useState<string>("");
  const [lastFetchISO, setLastFetchISO] = useState<string>("");
  const [lastModifiedISO, setLastModifiedISO] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState<string>("");
  const [linkStatus, setLinkStatus] = useState<string>("");
  const [isLinking, setIsLinking] = useState<boolean>(false);

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

  // Per-school language, initialized with defaults, persisted
  const [schoolLangs, setSchoolLangs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of SCHOOLS) {
      init[s] = SCHOOL_DEFAULTS[s as School] || "en";
    }
    return init;
  });

  // Load extras and schoolLangs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_EXTRAS);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, any>;
        const cleaned: Record<string, RowExtra> = {};
        for (const [k, v] of Object.entries(parsed)) {
          cleaned[k] = {
            englishPhrase: typeof v.englishPhrase === "string" ? v.englishPhrase : typeof v.box === "string" && !v.box.includes("[") ? "" : (v as any).englishPhrase || "",
            box: typeof v.box === "string" ? v.box : "",
            saving: !!v.saving,
            status: typeof v.status === "string" ? v.status : "",
          };
          // Migrate old: if box empty and no englishPhrase, default englishPhrase to spell name later via ensureRow fallback
          if (!cleaned[k].englishPhrase) {
            // leave empty, will be populated via spell name in UI via placeholder
          }
        }
        setExtras(cleaned);
      }
    } catch {}
    try {
      const rawL = localStorage.getItem(STORAGE_SCHOOL_LANGS);
      if (rawL) {
        const parsed = JSON.parse(rawL) as Record<string, string>;
        setSchoolLangs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  // Persist extras whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXTRAS, JSON.stringify(extras));
    } catch {}
  }, [extras]);

  // Persist schoolLangs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCHOOL_LANGS, JSON.stringify(schoolLangs));
    } catch {}
  }, [schoolLangs]);

  const ensureRow = useCallback(
    (spellName: string): RowExtra => {
      const existing = extras[spellName];
      if (existing) return existing;
      return { englishPhrase: "", box: "", saving: false, status: "" };
    },
    [extras]
  );

  const setRow = useCallback((name: string, patch: Partial<RowExtra>) => {
    setExtras((prev) => {
      const cur = prev[name] ?? { englishPhrase: "", box: "", saving: false, status: "" };
      const nextRow = { ...cur, ...patch };
      return { ...prev, [name]: nextRow };
    });
  }, []);

  // DDB link load on mount + auto-refetch if >4h
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LINK);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DdbLink;
      if (!parsed?.characterId || !Array.isArray(parsed.spells)) return;
      setSpellsArr(parsed.spells);
      setCharacterId(parsed.characterId);
      setCharacterName(parsed.characterName || "");
      setLastFetchISO(parsed.lastFetchISO || "");
      setLastModifiedISO(parsed.lastModifiedISO || null);
      if (parsed.lastFetchISO) {
        const age = Date.now() - new Date(parsed.lastFetchISO).getTime();
        if (age > FOUR_HOURS_MS) {
          setTimeout(() => {
            void fetchCharacter(parsed.characterId, { silent: true });
          }, 500);
        }
      }
      const firstWithSpells = SCHOOLS.find((s) => (parsed.spells as Spell[]).some((sp) => sp.school === s));
      if (firstWithSpells) setActiveSchool(firstWithSpells as School);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistLink = (link: DdbLink) => {
    try {
      localStorage.setItem(STORAGE_LINK, JSON.stringify(link));
    } catch {}
  };

  const fetchCharacter = async (idOrUrl: string, opts: { silent?: boolean } = {}) => {
    const id = extractIdForDisplay(idOrUrl);
    if (!id) {
      if (!opts.silent) setLinkStatus("Could not parse id – paste URL like https://www.dndbeyond.com/characters/12345678");
      return;
    }
    setIsLinking(true);
    if (!opts.silent) setLinkStatus("Fetching character…");
    try {
      const res = await fetch("/api/dndbeyond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrId: id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const spells: Spell[] = (j.spells || []).map((s: any) => ({ name: s.name, school: s.school }));
      const charName = j.characterName || "";
      const fetchTime = j.fetchTime || new Date().toISOString();
      const lastMod = j.lastModified || null;
      setSpellsArr(spells);
      setCharacterId(j.characterId || id);
      setCharacterName(charName);
      setLastFetchISO(fetchTime);
      setLastModifiedISO(lastMod);
      persistLink({
        characterId: j.characterId || id,
        characterName: charName,
        lastFetchISO: fetchTime,
        lastModifiedISO: lastMod,
        spells,
      });
      const firstWith = SCHOOLS.find((s) => spells.some((sp) => sp.school === s));
      if (firstWith) setActiveSchool(firstWith as School);
      if (!opts.silent) {
        setLinkStatus(`Loaded ${charName ? charName + " – " : ""}${spells.length} spells`);
        setTimeout(() => setLinkStatus(""), 2500);
      }
    } catch (e: any) {
      if (!opts.silent) setLinkStatus(`Error: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      setIsLinking(false);
    }
  };

  const onLinkClick = () => {
    const id = extractIdForDisplay(linkInput);
    if (!id) {
      setLinkStatus("Enter D&D Beyond URL or numeric id");
      return;
    }
    void fetchCharacter(id);
  };

  const onRefreshClick = () => {
    if (!characterId) return;
    void fetchCharacter(characterId);
  };

  const activeTargetLang = schoolLangs[activeSchool] || SCHOOL_DEFAULTS[activeSchool as School] || "en";

  const onTranslate = useCallback(async (spellName: string) => {
    const row = extras[spellName] ?? { englishPhrase: "", box: "", saving: false, status: "" };
    const sp = spellsArr.find((x) => x.name === spellName);
    if (!sp) return;
    // Use try phrasing if present, else spell name (like Space does)
    const textToTranslate = (row.englishPhrase || sp.name).trim();
    if (!textToTranslate) return;
    setRow(spellName, { saving: false, status: "translate..." });
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToTranslate, source: "en", target: activeTargetLang }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const translated = (j.translated as string) || "";
      const romanized = (j.romanized as string) || "";
      const box = formatBox(translated, romanized);
      setRow(spellName, { box, status: "ok" });
      setTimeout(() => setRow(spellName, { status: "" }), 1500);
    } catch (e: any) {
      setRow(spellName, { status: `err ${String(e?.message || e).slice(0, 80)}` });
    }
  }, [extras, spellsArr, activeTargetLang, setRow]);

  const onTrySave = useCallback(async (spellName: string) => {
    const row = extras[spellName] ?? { englishPhrase: "", box: "", saving: false, status: "" };
    setRow(spellName, { saving: true, status: "save..." });
    try {
      const { native, roman } = parseBox(row.box);
      if (!native) throw new Error("Translate first");
      setRow(spellName, { saving: false, status: `saved ${native.slice(0, 12)}${roman ? " [" + roman.slice(0, 10) + "]" : ""}` });
      setTimeout(() => setRow(spellName, { status: "" }), 1800);
    } catch (e: any) {
      setRow(spellName, { saving: false, status: `err ${String(e?.message || e).slice(0, 70)}` });
    }
  }, [extras, setRow]);

  const totalVerbal = spellsArr.length;
  const activeSpells = grouped[activeSchool] || [];

  const handleAudio = useCallback((spellName: string) => {
    const row = extras[spellName] ?? { englishPhrase: "", box: "", saving: false, status: "" };
    const { native } = parseBox(row.box);
    const t = native.trim();
    if (!t) return;
    const tl = activeTargetLang;
    void playCachedAudio(t, tl);
  }, [extras, activeTargetLang]);

  const handleIdiom = useCallback((spellName: string) => {
    const row = extras[spellName] ?? { englishPhrase: "", box: "", saving: false, status: "" };
    const sp = spellsArr.find((x) => x.name === spellName);
    const langName = getLangName(activeTargetLang);
    const englishPhrase = row.englishPhrase?.trim() || "";
    const tryText = englishPhrase || (parseBox(row.box).native || sp?.name || spellName).trim();
    window.open("https://www.google.com/search?q=" + encodeURIComponent(`idiom in ${langName} for "${tryText}"`), "_blank");
  }, [extras, spellsArr, activeTargetLang]);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* DDB Link Bar */}
      <div className="card px-5 py-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="flex-1 min-w-0">
            {characterId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold truncate">{characterName || `Character ${characterId}`}</span>
                <span className="text-[var(--dim)] text-xs">{totalVerbal} spells</span>
                {lastFetchISO ? (
                  <span className="text-xs text-[var(--dim)]" title={lastFetchISO}>
                    Last fetch {formatRelative(lastFetchISO)}
                    {lastModifiedISO ? ` • sheet modified ${formatRelative(lastModifiedISO)}` : ""}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-[var(--dim)]">No character linked – paste D&D Beyond URL to load spells</div>
            )}
          </div>
          <div className="flex gap-2">
            {characterId ? (
              <button onClick={onRefreshClick} disabled={isLinking} className="btn text-xs h-8 px-3">
                {isLinking ? "Refreshing…" : "Refresh"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input text-sm flex-1 h-10"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://www.dndbeyond.com/characters/12345678 or 12345678"
            onKeyDown={(e) => { if (e.key === "Enter") onLinkClick(); }}
          />
          <button onClick={onLinkClick} disabled={isLinking} className="btn text-sm h-10 sm:w-[160px]">
            {isLinking ? "Linking…" : characterId ? "Change" : "Link Character"}
          </button>
        </div>
        {linkStatus ? <div className="text-xs text-amber-200">{linkStatus}</div> : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {SCHOOLS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSchool(s as School)}
                className={`btn ${activeSchool === s ? "" : "btn-ghost"} text-[13px] px-3 py-1.5 rounded-full`}
              >
                {s} {grouped[s]?.length ? `· ${grouped[s].length}` : ""}
              </button>
            ))}
          </div>
          <div className="text-xs text-[var(--dim)]">{totalVerbal} spells</div>
        </div>

        {totalVerbal > 0 ? (
          <div className="flex items-center gap-3 text-sm card px-4 py-3 rounded-xl">
            <div className="text-sm font-medium whitespace-nowrap">
              {activeSchool} → <span className="text-[var(--dim)]">{getLangName(activeTargetLang)} ({activeTargetLang})</span>
            </div>
            <select
              className="input text-sm flex-1 max-w-[280px] h-9"
              value={activeTargetLang}
              onChange={(e) => setSchoolLangs((prev) => ({ ...prev, [activeSchool]: e.target.value }))}
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>{getLangOptionDisplay(o)}</option>
              ))}
            </select>
            <div className="text-[11px] text-[var(--dim)] hidden md:block">per-school, not per-spell</div>
          </div>
        ) : null}
      </div>

      {totalVerbal === 0 ? (
        <div className="card px-6 py-12 text-center space-y-3 rounded-xl">
          <div className="text-lg font-semibold">No spells yet</div>
          <div className="text-sm text-[var(--dim)] max-w-[420px] mx-auto">
            Link your D&amp;D Beyond character to see your spells here. Spells are generated per-character when you link a sheet – there is no static list.
          </div>
          <div className="text-xs text-[var(--dim)] pt-2">Paste D&amp;D Beyond URL above. Make sure sharing is enabled in D&D Beyond.</div>
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
                englishPhrase={row.englishPhrase}
                box={row.box}
                targetLang={activeTargetLang}
                status={row.status}
                saving={row.saving}
                onEnglishChange={(v) => setRow(sp.name, { englishPhrase: v })}
                onBoxChange={(v) => setRow(sp.name, { box: v })}
                onTranslate={() => onTranslate(sp.name)}
                onTrySave={() => onTrySave(sp.name)}
                onAudio={() => handleAudio(sp.name)}
                onIdiom={() => handleIdiom(sp.name)}
              />
            );
          })}
          {activeSpells.length === 0 ? (
            <div className="text-sm text-[var(--dim)] text-center py-8">No spells in {activeSchool}. Link a character to populate.</div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-[180px_1fr_1fr_140px] gap-3 px-3 text-[11px] text-[var(--dim)] uppercase tracking-wide">
            <div>Spell</div><div>Try phrasing</div><div>Chant box</div><div>Actions</div>
          </div>
          {activeSpells.map((sp) => {
            const row = extras[sp.name] ?? ensureRow(sp.name);
            return (
              <DesktopRow
                key={sp.name}
                spellName={sp.name}
                englishPhrase={row.englishPhrase}
                box={row.box}
                targetLang={activeTargetLang}
                status={row.status}
                onEnglishChange={(v) => setRow(sp.name, { englishPhrase: v })}
                onBoxChange={(v) => setRow(sp.name, { box: v })}
                onTranslate={() => onTranslate(sp.name)}
                onTrySave={() => onTrySave(sp.name)}
                onAudio={() => handleAudio(sp.name)}
                onIdiom={() => handleIdiom(sp.name)}
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
