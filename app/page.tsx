"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS, SCHOOL_DEFAULTS, LANG_OPTIONS, getLangOptionDisplay, formatBox, parseBox, getLangName } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { DesktopRow } from "@/components/DesktopRow";
import { MobileCard } from "@/components/MobileCard";
import { fetchCharacterClient, extractId as extractIdClient } from "@/lib/dndbeyond-client";

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

const STORAGE_LINK = "dnd-chant-ddb-link-v1";
const STORAGE_EXTRAS = "dnd-chant-extras-v1";
const STORAGE_SCHOOL_LANGS = "dnd-chant-school-langs-v1";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

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

  const [activeSchool, setActiveSchool] = useState<School>("Evocation");
  const [extras, setExtras] = useState<Record<string, RowExtra>>({});
  const [schoolLangs, setSchoolLangs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of SCHOOLS) {
      init[s] = SCHOOL_DEFAULTS[s as School] || "en";
    }
    return init;
  });

  // Load extras and schoolLangs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_EXTRAS);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, any>;
        const cleaned: Record<string, RowExtra> = {};
        for (const [k, v] of Object.entries(parsed)) {
          cleaned[k] = {
            englishPhrase: typeof v.englishPhrase === "string" ? v.englishPhrase : "",
            box: typeof v.box === "string" ? v.box : "",
            saving: !!v.saving,
            status: typeof v.status === "string" ? v.status : "",
          };
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXTRAS, JSON.stringify(extras));
    } catch {}
  }, [extras]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCHOOL_LANGS, JSON.stringify(schoolLangs));
    } catch {}
  }, [schoolLangs]);

  // DDB link load + auto-refetch >4h
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
      // set activeSchool to first school with spells
      const first = SCHOOLS.find((s) => (parsed.spells as Spell[]).some((sp) => sp.school === s));
      if (first) setActiveSchool(first as School);
      if (parsed.lastFetchISO) {
        const age = Date.now() - new Date(parsed.lastFetchISO).getTime();
        if (age > FOUR_HOURS_MS) {
          setTimeout(() => {
            void fetchCharacter(parsed.characterId, { silent: true });
          }, 500);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistLink = (link: DdbLink) => {
    try {
      localStorage.setItem(STORAGE_LINK, JSON.stringify(link));
    } catch {}
  };

  const fetchCharacter = async (idOrUrl: string, opts: { silent?: boolean } = {}) => {
    const id = extractIdClient(idOrUrl);
    if (!id) {
      if (!opts.silent) setLinkStatus("Could not parse id – paste URL like https://www.dndbeyond.com/characters/12345678");
      return;
    }
    setIsLinking(true);
    if (!opts.silent) setLinkStatus("Fetching character… (direct browser fetch, may be blocked by CORS)");
    try {
      const j = await fetchCharacterClient(id);
      const spells: Spell[] = (j.spells || []).map((s: any) => ({ name: s.name, school: s.school }));
      const charName = j.characterName || "";
      const fetchTime = j.fetchTime || new Date().toISOString();
      const lastMod = j.lastModified || null;
      setSpellsArr(spells);
      setCharacterId(j.characterId || id);
      setCharacterName(charName);
      setLastFetchISO(fetchTime);
      setLastModifiedISO(lastMod);
      const first = SCHOOLS.find((s) => spells.some((sp) => sp.school === s));
      if (first) setActiveSchool(first as School);
      persistLink({
        characterId: j.characterId || id,
        characterName: charName,
        lastFetchISO: fetchTime,
        lastModifiedISO: lastMod,
        spells,
      });
      if (!opts.silent) {
        setLinkStatus(`Loaded ${charName ? charName + " – " : ""}${spells.length} verbal spells (direct fetch)`);
        setTimeout(() => setLinkStatus(""), 2500);
      }
    } catch (e: any) {
      if (!opts.silent) setLinkStatus(`Error: ${String(e?.message || e).slice(0, 200)}`);
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

  const totalVerbal = spellsArr.length;
  const activeTargetLang = schoolLangs[activeSchool] || SCHOOL_DEFAULTS[activeSchool as School] || "en";
  const activeSpells = grouped[activeSchool] || [];

  const handleSave = useCallback((spellName: string, englishPhrase: string, native: string, roman: string) => {
    const box = formatBox(native, roman);
    setExtras((prev) => ({
      ...prev,
      [spellName]: {
        englishPhrase,
        box,
        saving: false,
        status: `✓ saved locally ${native.slice(0, 20)}`,
      },
    }));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 pb-[env(safe-area-inset-bottom)]">
      <main className="mx-auto max-w-6xl px-3 py-4 pb-10 md:px-4">
        {/* DDB Link Bar */}
        <div className="px-5 py-4 flex flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-800 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="flex-1 min-w-0">
              {characterId ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold truncate">{characterName || `Character ${characterId}`}</span>
                  <span className="text-zinc-400 text-xs">{totalVerbal} spells</span>
                  {lastFetchISO ? (
                    <span className="text-xs text-zinc-400" title={lastFetchISO}>
                      Last fetch {formatRelative(lastFetchISO)}
                      {lastModifiedISO ? ` • sheet modified ${formatRelative(lastModifiedISO)}` : ""}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-zinc-400">No character linked – paste D&D Beyond URL to load spells</div>
              )}
            </div>
            <div className="flex gap-2">
              {characterId ? (
                <button onClick={onRefreshClick} disabled={isLinking} className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg text-xs h-8 px-3 hover:bg-zinc-600 disabled:opacity-60">
                  {isLinking ? "Refreshing…" : "Refresh"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 h-10 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://www.dndbeyond.com/characters/12345678 or 12345678"
              onKeyDown={(e) => { if (e.key === "Enter") onLinkClick(); }}
            />
            <button onClick={onLinkClick} disabled={isLinking} className="bg-amber-400 text-black rounded-lg text-sm h-10 sm:w-[160px] font-semibold hover:bg-amber-300 disabled:opacity-60">
              {isLinking ? "Linking…" : characterId ? "Change" : "Link Character"}
            </button>
          </div>
          {linkStatus ? <div className="text-xs text-amber-200">{linkStatus}</div> : null}
        </div>

        <header className="mb-5">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">D&D Chants</h1>
            <p className="mt-1 text-[13px] md:text-sm text-zinc-400 max-w-[34rem] leading-snug">
              <span className="md:hidden">Tap a school to reword. Link your D&D Beyond character above.</span>
              <span className="hidden md:inline">{totalVerbal ? `${totalVerbal} spells grouped by school. ` : ""}Type a new English cue, hit ▶ to translate, 🔊 to hear it, 💾 to save locally.</span>
            </p>
          </div>
        </header>

        {/* Per-school tabs - keep, user said good */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SCHOOLS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSchool(s as School)}
              className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors ${
                activeSchool === s
                  ? "bg-amber-400 text-black border-amber-400"
                  : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
              }`}
            >
              {s} {grouped[s]?.length ? `· ${grouped[s].length}` : ""}
            </button>
          ))}
        </div>

        {totalVerbal === 0 ? (
          <div className="px-6 py-12 text-center space-y-3 rounded-xl border border-zinc-700 bg-zinc-800">
            <div className="text-lg font-semibold">No spells yet</div>
            <div className="text-sm text-zinc-400 max-w-[420px] mx-auto">
              Link your D&amp;D Beyond character to see your spells here. Spells are generated per-character when you link a sheet – there is no static list.
            </div>
            <div className="text-xs text-zinc-500 pt-2">Paste D&amp;D Beyond URL above. Make sure sharing is enabled in D&D Beyond.</div>
          </div>
        ) : (
          <section className="mb-5 md:mb-8 rounded-[14px] md:rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 px-3 py-3 md:px-4 border-b border-zinc-700 bg-zinc-800">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] md:text-lg font-semibold">
                  {activeSchool} - {SCHOOL_DESCS[activeSchool]}
                </h2>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400">
                  {activeSpells.length}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm w-full md:w-auto">
                <span className="text-zinc-400 text-xs md:text-sm shrink-0">Language</span>
                <select
                  aria-label={`Language for ${activeSchool}`}
                  className="flex-1 md:flex-none rounded-lg md:rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 px-2.5 py-2.5 md:py-1.5 text-[14px] md:text-sm max-w-none md:max-w-[14rem] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={activeTargetLang}
                  onChange={(e) => setSchoolLangs((prev) => ({ ...prev, [activeSchool]: e.target.value }))}
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={`${o.code}-${o.label}`} value={o.code}>
                      {getLangOptionDisplay(o)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Desktop table - rows identical to space */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-zinc-400 border-b border-zinc-700">
                    <th className="py-2 px-2 font-medium">Spell</th>
                    <th className="py-2 px-2 font-medium">Try phrasing</th>
                    <th className="py-2 px-1 font-medium">Go</th>
                    <th className="py-2 px-2 font-medium">Result</th>
                    <th className="py-2 px-1 font-medium w-[128px] min-w-[128px] max-w-[128px] whitespace-nowrap">Save / Audio</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSpells.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-zinc-400">
                        No spells in {activeSchool}. Link a character to populate.
                      </td>
                    </tr>
                  ) : (
                    activeSpells.map((sp) => {
                      const extra = extras[sp.name];
                      const tryDefault = extra?.englishPhrase || sp.name;
                      const parsed = extra?.box ? parseBox(extra.box) : { native: "", roman: "" };
                      return (
                        <DesktopRow
                          key={`d-${activeSchool}-${sp.name}-${activeTargetLang}`}
                          spell={sp}
                          targetLang={activeTargetLang}
                          school={activeSchool}
                          initialInput={tryDefault}
                          initialNative={parsed.native}
                          initialRoman={parsed.roman}
                          onSave={(en, nat, rom) => handleSave(sp.name, en, nat, rom)}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards - identical to space */}
            <div className="md:hidden divide-y divide-zinc-700">
              {activeSpells.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">No spells in {activeSchool}. Link a character to populate.</div>
              ) : (
                activeSpells.map((sp) => {
                  const extra = extras[sp.name];
                  const tryDefault = extra?.englishPhrase || sp.name;
                  const parsed = extra?.box ? parseBox(extra.box) : { native: "", roman: "" };
                  return (
                    <MobileCard
                      key={`m-${activeSchool}-${sp.name}-${activeTargetLang}`}
                      spell={sp}
                      targetLang={activeTargetLang}
                      school={activeSchool}
                      initialInput={tryDefault}
                      initialNative={parsed.native}
                      initialRoman={parsed.roman}
                      onSave={(en, nat, rom) => handleSave(sp.name, en, nat, rom)}
                    />
                  );
                })
              )}
            </div>
          </section>
        )}

        <footer className="mt-8 text-[11px] md:text-xs text-zinc-500 leading-relaxed px-1 md:px-0 text-center">
          Everything is saved locally
        </footer>
      </main>
    </div>
  );
}
