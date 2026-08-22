"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS, SCHOOL_DEFAULTS, LANG_OPTIONS, getLangOptionDisplay, formatBox, parseBox } from "@/lib/lang";
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

type StoredCharacter = {
  characterId: string;
  characterName: string;
  lastFetchISO: string;
  lastModifiedISO: string | null;
  spells: Spell[];
};

type DdbLinkLegacy = {
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
const STORAGE_CHARACTERS = "dnd-chant-characters-v1";
const STORAGE_ACTIVE = "dnd-chant-active-character-v1";
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
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [linkInput, setLinkInput] = useState<string>("");
  const [linkStatus, setLinkStatus] = useState<string>("");
  const [isLinking, setIsLinking] = useState<boolean>(false);

  const [activeSchool, setActiveSchool] = useState<School>("Evocation");

  // extras per-character: charId -> spellName -> RowExtra
  const [extrasPerChar, setExtrasPerChar] = useState<Record<string, Record<string, RowExtra>>>({});
  // schoolLangs per-character: charId -> school -> langCode
  const [schoolLangsPerChar, setSchoolLangsPerChar] = useState<Record<string, Record<string, string>>>({});

  const activeCharacter = useMemo(() => {
    if (!characters.length) return null;
    return characters.find((c) => c.characterId === activeId) || characters[0];
  }, [characters, activeId]);

  const spellsArr = activeCharacter?.spells || [];
  const characterId = activeCharacter?.characterId || "";
  const characterName = activeCharacter?.characterName || "";
  const lastFetchISO = activeCharacter?.lastFetchISO || "";
  const lastModifiedISO = activeCharacter?.lastModifiedISO || null;

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

  // Load characters, active, extras, schoolLangs with migration
  useEffect(() => {
    try {
      let loadedChars: StoredCharacter[] = [];
      let loadedActive = "";

      const rawChars = localStorage.getItem(STORAGE_CHARACTERS);
      if (rawChars) {
        const parsed = JSON.parse(rawChars) as StoredCharacter[];
        if (Array.isArray(parsed) && parsed.length) {
          loadedChars = parsed
            .filter((c) => c?.characterId && Array.isArray(c.spells))
            .map((c) => ({
              characterId: String(c.characterId),
              characterName: String(c.characterName || ""),
              lastFetchISO: String(c.lastFetchISO || ""),
              lastModifiedISO: c.lastModifiedISO ? String(c.lastModifiedISO) : null,
              spells: Array.isArray(c.spells) ? c.spells : [],
            }));
        }
      }

      // migration from old single link
      if (!loadedChars.length) {
        const rawLink = localStorage.getItem(STORAGE_LINK);
        if (rawLink) {
          try {
            const parsed = JSON.parse(rawLink) as DdbLinkLegacy;
            if (parsed?.characterId && Array.isArray(parsed.spells)) {
              loadedChars = [
                {
                  characterId: String(parsed.characterId),
                  characterName: String(parsed.characterName || ""),
                  lastFetchISO: String(parsed.lastFetchISO || new Date().toISOString()),
                  lastModifiedISO: parsed.lastModifiedISO ? String(parsed.lastModifiedISO) : null,
                  spells: parsed.spells,
                },
              ];
            }
          } catch {}
        }
      }

      const rawActive = localStorage.getItem(STORAGE_ACTIVE);
      if (rawActive) {
        loadedActive = String(rawActive);
      }

      if (loadedChars.length) {
        setCharacters(loadedChars);
        if (loadedActive && loadedChars.some((c) => c.characterId === loadedActive)) {
          setActiveId(loadedActive);
        } else {
          setActiveId(loadedChars[0].characterId);
        }
        const firstWithSpells = SCHOOLS.find((s) => loadedChars[0].spells.some((sp) => sp.school === s));
        if (firstWithSpells) setActiveSchool(firstWithSpells as School);

        // auto-refetch >4h for active
        const active = loadedChars.find((c) => c.characterId === (loadedActive || loadedChars[0].characterId)) || loadedChars[0];
        if (active?.lastFetchISO) {
          const age = Date.now() - new Date(active.lastFetchISO).getTime();
          if (age > FOUR_HOURS_MS) {
            setTimeout(() => {
              void fetchCharacterInternal(active.characterId, { silent: true }, loadedChars);
            }, 600);
          }
        }
      }

      // extras load with legacy detection
      const rawExtras = localStorage.getItem(STORAGE_EXTRAS);
      if (rawExtras) {
        try {
          const parsed = JSON.parse(rawExtras) as any;
          if (parsed && typeof parsed === "object") {
            const firstVal = Object.values(parsed)[0] as any;
            const isLegacyFlat = firstVal && typeof firstVal === "object" && "englishPhrase" in firstVal;
            if (isLegacyFlat) {
              // legacy flat -> migrate into active/first char
              const targetId = loadedActive || loadedChars[0]?.characterId;
              if (targetId) {
                const cleaned: Record<string, RowExtra> = {};
                for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
                  cleaned[k] = {
                    englishPhrase: typeof v.englishPhrase === "string" ? v.englishPhrase : "",
                    box: typeof v.box === "string" ? v.box : "",
                    saving: !!v.saving,
                    status: typeof v.status === "string" ? v.status : "",
                  };
                }
                setExtrasPerChar({ [targetId]: cleaned });
              }
            } else {
              // per-char format
              const cleanedPerChar: Record<string, Record<string, RowExtra>> = {};
              for (const [charId, spellMap] of Object.entries(parsed as Record<string, any>)) {
                if (!spellMap || typeof spellMap !== "object") continue;
                const inner: Record<string, RowExtra> = {};
                for (const [spellName, v] of Object.entries(spellMap as Record<string, any>)) {
                  inner[spellName] = {
                    englishPhrase: typeof (v as any).englishPhrase === "string" ? (v as any).englishPhrase : "",
                    box: typeof (v as any).box === "string" ? (v as any).box : "",
                    saving: !!(v as any).saving,
                    status: typeof (v as any).status === "string" ? (v as any).status : "",
                  };
                }
                cleanedPerChar[charId] = inner;
              }
              setExtrasPerChar(cleanedPerChar);
            }
          }
        } catch {}
      }

      // schoolLangs load with legacy detection
      const rawLangs = localStorage.getItem(STORAGE_SCHOOL_LANGS);
      if (rawLangs) {
        try {
          const parsed = JSON.parse(rawLangs) as any;
          if (parsed && typeof parsed === "object") {
            const firstVal = Object.values(parsed)[0];
            const isLegacyFlat = typeof firstVal === "string";
            if (isLegacyFlat) {
              const targetId = loadedActive || loadedChars[0]?.characterId;
              if (targetId) {
                const merged: Record<string, string> = {};
                for (const [k, v] of Object.entries(parsed as Record<string, string>)) {
                  if (typeof v === "string") merged[k] = v;
                }
                setSchoolLangsPerChar({ [targetId]: merged });
              }
            } else {
              const cleaned: Record<string, Record<string, string>> = {};
              for (const [charId, inner] of Object.entries(parsed as Record<string, any>)) {
                if (!inner || typeof inner !== "object") continue;
                const m: Record<string, string> = {};
                for (const [school, code] of Object.entries(inner as Record<string, string>)) {
                  if (typeof code === "string") m[school] = code;
                }
                cleaned[charId] = m;
              }
              setSchoolLangsPerChar(cleaned);
            }
          }
        } catch {}
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHARACTERS, JSON.stringify(characters));
    } catch {}
  }, [characters]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(STORAGE_ACTIVE, activeId);
    } catch {}
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXTRAS, JSON.stringify(extrasPerChar));
    } catch {}
  }, [extrasPerChar]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCHOOL_LANGS, JSON.stringify(schoolLangsPerChar));
    } catch {}
  }, [schoolLangsPerChar]);

  const fetchCharacterInternal = async (idOrUrl: string, opts: { silent?: boolean } = {}, existingChars?: StoredCharacter[]) => {
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
      const charId = j.characterId || id;

      const base = existingChars || characters;
      setCharacters((prev) => {
        const src = existingChars ? base : prev;
        const idx = src.findIndex((c) => c.characterId === charId);
        if (idx >= 0) {
          const copy = [...src];
          copy[idx] = {
            characterId: charId,
            characterName: charName,
            lastFetchISO: fetchTime,
            lastModifiedISO: lastMod,
            spells,
          };
          return copy;
        } else {
          return [
            ...src,
            {
              characterId: charId,
              characterName: charName,
              lastFetchISO: fetchTime,
              lastModifiedISO: lastMod,
              spells,
            },
          ];
        }
      });
      setActiveId(charId);
      const first = SCHOOLS.find((s) => spells.some((sp) => sp.school === s));
      if (first) setActiveSchool(first as School);
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

  const fetchCharacter = async (idOrUrl: string, opts: { silent?: boolean } = {}) => {
    await fetchCharacterInternal(idOrUrl, opts);
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

  const onSwitchCharacter = (cid: string) => {
    setActiveId(cid);
    const c = characters.find((ch) => ch.characterId === cid);
    if (c) {
      const first = SCHOOLS.find((s) => c.spells.some((sp) => sp.school === s));
      if (first) setActiveSchool(first as School);
    }
  };

  const onRemoveCharacter = (cid: string) => {
    const idx = characters.findIndex((c) => c.characterId === cid);
    if (idx < 0) return;
    const newChars = characters.filter((c) => c.characterId !== cid);
    setCharacters(newChars);
    // cleanup per-char data
    setExtrasPerChar((prev) => {
      const copy = { ...prev };
      delete copy[cid];
      return copy;
    });
    setSchoolLangsPerChar((prev) => {
      const copy = { ...prev };
      delete copy[cid];
      return copy;
    });
    if (activeId === cid) {
      if (newChars.length) {
        const next = newChars[Math.min(idx, newChars.length - 1)];
        setActiveId(next.characterId);
      } else {
        setActiveId("");
      }
    }
    if (newChars.length === 0) {
      try {
        localStorage.removeItem(STORAGE_ACTIVE);
      } catch {}
    }
  };

  const totalVerbal = spellsArr.length;
  const activeLangs = activeId ? schoolLangsPerChar[activeId] || {} : {};
  const activeTargetLang = activeLangs[activeSchool] || (SCHOOL_DEFAULTS[activeSchool as School] as string) || "en";
  const activeSpells = grouped[activeSchool] || [];
  const activeExtras = activeId ? extrasPerChar[activeId] || {} : {};

  const handleSave = useCallback((spellName: string, englishPhrase: string, native: string, roman: string) => {
    if (!activeId) return;
    const box = formatBox(native, roman);
    setExtrasPerChar((prev) => ({
      ...prev,
      [activeId]: {
        ...(prev[activeId] || {}),
        [spellName]: {
          englishPhrase,
          box,
          saving: false,
          status: `✓ saved locally ${native.slice(0, 20)}`,
        },
      },
    }));
  }, [activeId]);

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 pb-[env(safe-area-inset-bottom)]">
      <main className="mx-auto max-w-6xl px-3 py-4 pb-10 md:px-4">
        {/* Multi-character DDB Link Bar */}
        <div className="px-5 py-4 flex flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-800 mb-5">
          {characters.length > 0 ? ( // pills row
            <div className="flex flex-wrap gap-2">
              {characters.map((c) => (
                <div key={c.characterId} className="flex items-center gap-0">
                  <button
                    onClick={() => onSwitchCharacter(c.characterId)}
                    className={`text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                      activeId === c.characterId || (!activeId && characters[0]?.characterId === c.characterId)
                        ? "bg-amber-400 text-black border-amber-400"
                        : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                    }`}
                  >
                    <span className="truncate max-w-[10rem]">{c.characterName || `Char ${c.characterId}`}</span>
                    <span className="text-[11px] opacity-70">·{c.spells.length}</span>
                  </button>
                  <button
                    onClick={() => onRemoveCharacter(c.characterId)}
                    aria-label={`Remove ${c.characterName || c.characterId}`}
                    className="ml-1 text-zinc-500 hover:text-zinc-200 text-[12px] px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="flex-1 min-w-0">
              {activeCharacter ? (
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
              {activeCharacter ? (
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
              {isLinking ? "Linking…" : characters.length ? "Add Character" : "Link Character"}
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

        {/* Per-school tabs */}
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

            {/* Desktop table */}
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
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-zinc-700">
              {activeSpells.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">No spells in {activeSchool}. Link a character to populate.</div>
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
