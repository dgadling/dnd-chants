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
const STORAGE_HELP_TEMPLATE = "dnd-chant-help-template-v1";
const DEFAULT_HELP_TEMPLATE =
  "Help me come up with a short chant or idiom for the Dungeons & Dragons spell {spell} in {language} that would sound reasonable to a native speaker.";
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
  const [showAddCharacter, setShowAddCharacter] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [showHelpConfig, setShowHelpConfig] = useState<boolean>(false);
  const [showPrivacy, setShowPrivacy] = useState<boolean>(false);
  const [helpTemplate, setHelpTemplate] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HELP_TEMPLATE);
      if (raw && typeof raw === "string" && raw.trim()) return raw;
    } catch {}
    return DEFAULT_HELP_TEMPLATE;
  });

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

      // help template load (also lazy init covers first render)
      try {
        const rawHelp = localStorage.getItem(STORAGE_HELP_TEMPLATE);
        if (rawHelp && typeof rawHelp === "string" && rawHelp.trim()) {
          setHelpTemplate(rawHelp);
        }
      } catch {}
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

  useEffect(() => {
    try {
      if (helpTemplate && helpTemplate.trim()) {
        localStorage.setItem(STORAGE_HELP_TEMPLATE, helpTemplate);
      }
    } catch {}
  }, [helpTemplate]);

  // Escape closes drawer/modal on mobile
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPrivacy) {
          setShowPrivacy(false);
          return;
        }
        if (showHelpConfig) {
          setShowHelpConfig(false);
          return;
        }
        if (pendingDeleteId) {
          setPendingDeleteId(null);
          return;
        }
        if (showAddCharacter) {
          setShowAddCharacter(false);
          setLinkInput("");
          setLinkStatus("");
          return;
        }
        if (drawerOpen && window.innerWidth < 1024) {
          setDrawerOpen(false);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPrivacy, showHelpConfig, pendingDeleteId, showAddCharacter, drawerOpen]);

  const fetchCharacterInternal = async (idOrUrl: string, opts: { silent?: boolean } = {}, existingChars?: StoredCharacter[]) => {
    const id = extractIdClient(idOrUrl);
    if (!id) {
      if (!opts.silent) setLinkStatus("Could not parse id – paste URL like https://www.dndbeyond.com/characters/12345678");
      return;
    }
    setIsLinking(true);
    if (!opts.silent) setLinkStatus("Fetching character…");
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
      setShowAddCharacter(false);
      setLinkInput("");
      const first = SCHOOLS.find((s) => spells.some((sp) => sp.school === s));
      if (first) setActiveSchool(first as School);
      if (!opts.silent) {
        setLinkStatus(`Loaded ${charName ? charName + " – " : ""}${spells.length} verbal spells`);
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
    if (window.innerWidth < 1024) {
      // keep drawer open on desktop, close on mobile after switch for usability
      setDrawerOpen(false);
    }
  };

  const onRemoveCharacter = (cid: string) => {
    setPendingDeleteId(cid);
  };

  const confirmRemoveCharacter = () => {
    const cid = pendingDeleteId;
    if (!cid) return;
    const idx = characters.findIndex((c) => c.characterId === cid);
    if (idx < 0) {
      setPendingDeleteId(null);
      return;
    }
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
    setPendingDeleteId(null);
  };

  const totalVerbal = spellsArr.length;
  const hasChars = characters.length > 0;
  const activeLangs = activeId ? schoolLangsPerChar[activeId] || {} : {};
  const activeTargetLang = activeLangs[activeSchool] || (SCHOOL_DEFAULTS[activeSchool as School] as string) || "en";
  const activeSpells = grouped[activeSchool] || [];
  const activeExtras = activeId ? extrasPerChar[activeId] || {} : {};

  const handleSave = useCallback((spellName: string, englishPhrase: string, native: string, roman: string) => {
    if (!activeId) return;
    const box = formatBox(native, roman);
    const cleanPhrase = (englishPhrase || "").slice(0, 500);
    const cleanBox = box.slice(0, 1100);
    setExtrasPerChar((prev) => ({
      ...prev,
      [activeId]: {
        ...(prev[activeId] || {}),
        [spellName]: {
          englishPhrase: cleanPhrase,
          box: cleanBox,
        },
      },
    }));
  }, [activeId]);

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 antialiased flex">
      {/* Backdrop mobile */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      {/* Left Drawer - 240px persistent desktop, overlay mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[300px] max-w-[85vw] bg-zinc-800 border-r border-zinc-700 flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:w-[240px] lg:max-w-none lg:shrink-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-amber-400 text-black grid place-items-center font-bold text-[13px]">D</div>
            <span className="font-semibold tracking-tight text-[15px]">D&D Chants</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden h-8 w-8 grid place-items-center rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
          {/* Characters Section */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-[11px] uppercase tracking-widest font-semibold text-zinc-400">Characters</h2>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-500 ${hasChars ? "" : "hidden"}`}>
                {characters.length}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {!hasChars ? (
                <div className="text-[12px] text-zinc-500 px-2 py-3 rounded-lg bg-zinc-900/60 border border-dashed border-zinc-700/60">
                  No characters yet. Add your first D&D Beyond character to begin.
                </div>
              ) : (
                characters.map((c) => {
                  const isActive = activeId === c.characterId || (!activeId && characters[0]?.characterId === c.characterId);
                  const isExpanded = isActive;
                  const fetchText = isActive ? formatRelative(lastFetchISO) : "";
                  const modText = isActive && lastModifiedISO ? formatRelative(lastModifiedISO) : null;
                  return (
                    <div
                      key={c.characterId}
                      className={`group flex flex-col rounded-xl border transition-colors ${
                        isActive ? "bg-zinc-900 border-amber-400/40 text-zinc-100 p-2.5" : "bg-zinc-900/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700/50 hover:border-zinc-600 px-2.5 py-2"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          className="flex-1 min-w-0 text-left flex items-center gap-1.5"
                          onClick={() => onSwitchCharacter(c.characterId)}
                        >
                          <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-amber-400" : "bg-zinc-600 group-hover:bg-zinc-500"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{c.characterName || `Char ${c.characterId}`}</div>
                          </div>
                        </button>

                        <span className="text-[10px] text-zinc-500 hidden sm:inline">·{c.spells.length}</span>

                        <a
                          href={`https://www.dndbeyond.com/characters/${c.characterId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-6 w-6 grid place-items-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 shrink-0"
                          title="Open in D&D Beyond"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>

                        <button
                          className="h-6 w-6 grid place-items-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-300 text-[13px] shrink-0"
                          onClick={(e) => { e.stopPropagation(); onRemoveCharacter(c.characterId); }}
                          aria-label={`Delete ${c.characterName || c.characterId}`}
                          title={`Delete ${c.characterName || c.characterId}`}
                        >
                          ×
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className="mt-2 pt-2 border-t border-zinc-700/60 space-y-1">
                          <div className="text-[11px] text-zinc-500">Last fetch {fetchText}</div>
                          {modText ? <div className="text-[11px] text-zinc-500">Sheet modified {modText}</div> : null}
                          <button
                            onClick={onRefreshClick}
                            disabled={isLinking}
                            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg text-[12px] h-8 px-3 hover:bg-zinc-600 disabled:opacity-60"
                          >
                            <span>↻</span>
                            <span>{isLinking ? "Refreshing…" : "Refresh"}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowAddCharacter(true)}
              className="mt-3 w-full text-[13px] px-3 py-2.5 rounded-lg border border-dashed border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700/50 transition-colors font-medium flex items-center justify-center gap-1.5"
            >
              <span className="text-[14px]">+</span> Add Character
            </button>

            <button
              onClick={() => setShowHelpConfig(true)}
              className="mt-2 w-full text-[12px] px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 hover:border-zinc-600 transition-colors font-medium flex items-center justify-center gap-1.5"
            >
              ⚙ Configure help
            </button>
          </div>
        </div>

        <div className="px-3 py-3 border-t border-zinc-700/70 text-[11px] text-zinc-500">
          <button
            onClick={() => setShowPrivacy(true)}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
          >
            Privacy Policy
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar with hamburger tight spacing 18x14 2px gap3 */}
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-3 py-3 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
          <button
            onClick={() => setDrawerOpen(true)}
            className="h-9 w-9 grid place-items-center rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            aria-label="Open menu"
          >
            <span className="flex flex-col justify-center" style={{ width: "18px", height: "14px", gap: "3px" }}>
              <span className="block rounded-full bg-current" style={{ width: "18px", height: "2px" }}></span>
              <span className="block rounded-full bg-current" style={{ width: "18px", height: "2px" }}></span>
              <span className="block rounded-full bg-current" style={{ width: "18px", height: "2px" }}></span>
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[15px] tracking-tight leading-none">🐉 D&D Chants</div>
            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
              {activeCharacter ? `${characterName || "Character"} • ${totalVerbal}` : "No character"}
            </div>
          </div>
        </div>

        <main className="flex-1 mx-auto w-full max-w-5xl px-3 py-4 lg:px-6 lg:py-6 pb-10">
          {/* Desktop header - no Refresh, no active details here */}
          <header className="mb-5 hidden lg:block">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">🐉 D&D Chants</h1>
            <p className="mt-1 text-[13px] md:text-sm text-zinc-400 max-w-[34rem] leading-snug">
              {totalVerbal ? `${totalVerbal} spells grouped by school. ` : ""}Type a new English cue, hit ▶ to translate, 🔊 to hear it.
            </p>
          </header>

          {/* School pills count only, dim zero, amber active, all dimmed when no chars */}
          <div className="flex flex-wrap gap-2 mb-4">
            {SCHOOLS.map((s) => {
              const count = grouped[s]?.length || 0;
              const isActive = hasChars && activeSchool === s;
              if (isActive) {
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSchool(s as School)}
                    className="text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors bg-amber-400 text-black border-amber-400"
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
                    className="text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors bg-zinc-800 text-zinc-500 opacity-60 hover:opacity-80 border-zinc-700/60 hover:bg-zinc-700 hover:text-zinc-400"
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
                  className="text-[13px] px-3 py-1.5 rounded-full border font-medium transition-colors bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"
                  title={`${s} - ${SCHOOL_DESCS[s]} (${count} spells)`}
                >
                  {`${s} · ${count}`}
                </button>
              );
            })}
          </div>

          {totalVerbal === 0 ? (
            <div className="px-6 py-12 text-center space-y-3 rounded-xl border border-zinc-700 bg-zinc-800">
              <div className="text-lg font-semibold">No spells yet</div>
              <div className="text-sm text-zinc-400 max-w-[420px] mx-auto">
                Link your D&amp;D Beyond character from the left drawer to see your spells here. The app fetches live via the proxy at <span className="text-zinc-300">/api/dndbeyond/{`{id}`}</span>.
              </div>
              <div className="text-xs text-zinc-500 pt-2">Once linked, schools show count only and dim when empty. Everything is saved locally.</div>
              <button
                onClick={() => { setDrawerOpen(true); setShowAddCharacter(true); }}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 text-black text-[13px] font-semibold hover:bg-amber-300 lg:hidden"
              >
                + Add Character
              </button>
            </div>
          ) : (
            <section className="mb-5 md:mb-8 rounded-[14px] md:rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 px-3 py-3 md:px-4 border-b border-zinc-700 bg-zinc-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] md:text-lg font-semibold">
                    <span className="text-amber-300/90">{activeSchool}</span>
                    <span className="text-zinc-400 font-normal"> - {SCHOOL_DESCS[activeSchool]}</span>
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
                            helpTemplate={helpTemplate}
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
                        helpTemplate={helpTemplate}
                      />
                    );
                  })
                )}
              </div>
            </section>
          )}

        </main>
      </div>

      {/* Add Character modal */}
      {showAddCharacter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">Add Character</h3>
            <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide mb-2">D&D Beyond URL or ID</div>
            <input
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://www.dndbeyond.com/characters/12345678 or 12345678"
              onKeyDown={(e) => { if (e.key === "Enter") onLinkClick(); }}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button onClick={onLinkClick} disabled={isLinking} className="flex-1 bg-amber-400 text-black rounded-lg text-sm h-10 font-semibold hover:bg-amber-300 disabled:opacity-60">
                {isLinking ? "Linking…" : characters.length ? "Add Character" : "Link Character"}
              </button>
              <button onClick={() => { setShowAddCharacter(false); setLinkInput(""); setLinkStatus(""); }} className="bg-zinc-700 text-zinc-200 rounded-lg text-sm h-10 px-4 hover:bg-zinc-600">
                Cancel
              </button>
            </div>
            {linkStatus ? <div className="text-xs text-amber-200 mt-2">{linkStatus}</div> : null}
          </div>
        </div>
      ) : null}

      {pendingDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2">Delete character?</h3>
            <p className="text-xs text-zinc-400 mb-4">
              This will remove {characters.find((c) => c.characterId === pendingDeleteId)?.characterName || `Char ${pendingDeleteId}`} and all saved chants for this character from this browser. The action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingDeleteId(null)} className="bg-zinc-700 text-zinc-200 rounded-lg text-xs h-8 px-4 hover:bg-zinc-600">
                Cancel
              </button>
              <button onClick={confirmRemoveCharacter} className="bg-red-600 text-white rounded-lg text-xs h-8 px-4 hover:bg-red-500 font-semibold">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showHelpConfig ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowHelpConfig(false)}
        >
          <div
            className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-zinc-100 mb-2">Configure help</h3>
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
              This template is used when you click the Help button 💬. Use {"{spell}"} and {"{language}"} as placeholders. They will be replaced with the spell name and language. {"{school}"} is also available.
            </p>
            <textarea
              className="w-full min-h-[96px] rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
              rows={4}
              value={helpTemplate}
              onChange={(e) => setHelpTemplate(e.target.value)}
              placeholder={DEFAULT_HELP_TEMPLATE}
            />
            <div className="flex justify-between gap-2 mt-4">
              <button
                onClick={() => setHelpTemplate(DEFAULT_HELP_TEMPLATE)}
                className="bg-zinc-700 text-zinc-200 rounded-lg text-xs h-8 px-4 hover:bg-zinc-600"
              >
                Default
              </button>
              <button
                onClick={() => setShowHelpConfig(false)}
                className="bg-amber-400 text-black rounded-lg text-xs h-8 px-4 hover:bg-amber-300 font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPrivacy ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPrivacy(false)}
        >
          <div
            className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-100">Privacy Policy</h3>
              <button
                onClick={() => setShowPrivacy(false)}
                className="h-7 w-7 grid place-items-center rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-[13px] leading-relaxed text-zinc-300">
              <p>Everything you type and your characters are stored locally in your browser (localStorage and IndexedDB). We do not have accounts or servers storing your personal stuff.</p>
              <p>When you load a character, we fetch it from D&amp;D Beyond via our proxy (api/dndbeyond). We do not keep a copy on our servers, we just pass it through.</p>
              <p>When you translate or play audio, we send the spell text and language to Google Translate via our proxy (api/tts and translate). No personal info, just the chant text.</p>
              <p>When you click Help for idioms, we open a Google AI search with your prompt. That is Google&apos;s site, not ours.</p>
              <p>No cookies, no tracking, no analytics. If you clear your browser data, your chants go away too.</p>
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowPrivacy(false)}
                className="bg-amber-400 text-black rounded-lg text-xs h-8 px-4 hover:bg-amber-300 font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
