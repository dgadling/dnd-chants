"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { fetchCharacterClient } from "@/lib/dndbeyond-client";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { extractCharacterId } from "@/lib/extractCharacterId";
import { FOUR_HOURS_MS } from "@/lib/constants";

export type Spell = {
  name: string;
  school: string;
};

export type StoredCharacter = {
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

export function useCharacters(activeSchool?: School, setActiveSchool?: (s: School) => void) {
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [linkStatus, setLinkStatus] = useState<string>("");

  const activeCharacter = useMemo(() => {
    if (!characters.length) return null;
    return characters.find((c) => c.characterId === activeId) || characters[0];
  }, [characters, activeId]);

  const spellsArr = useMemo(() => activeCharacter?.spells || [], [activeCharacter]);

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

  // Load with migration
  useEffect(() => {
    try {
      let loadedChars: StoredCharacter[] = [];
      let loadedActive = "";

      const rawChars = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
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

      if (!loadedChars.length) {
        const rawLink = localStorage.getItem(STORAGE_KEYS.DDB_LINK);
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

      const rawActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
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
        if (firstWithSpells && setActiveSchool) setActiveSchool(firstWithSpells as School);

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
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persistence for characters
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
    } catch {}
  }, [characters]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeId);
    } catch {}
  }, [activeId]);

  const fetchCharacterInternal = async (idOrUrl: string, opts: { silent?: boolean } = {}, existingChars?: StoredCharacter[]) => {
    const id = extractCharacterId(idOrUrl);
    if (!id) {
      if (!opts.silent) setLinkStatus("Invalid URL. Check carefully and try again");
      return null;
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
      const rawTotal = (j as any).rawTotalSpells ?? (j as any).totalRawSpells ?? spells.length;

      // Case 2: zero spells total
      if (rawTotal === 0) {
        if (!opts.silent) setLinkStatus(`You seem a little too martial for this site (I don't see any spells)`);
        return null;
      }
      // Case 3: has spells but zero verbal
      if (spells.length === 0 && rawTotal > 0) {
        if (!opts.silent) setLinkStatus(`While you have ${rawTotal} spell${rawTotal===1?"":"s"}, none of them have verbal components. This site won't do much for you`);
        return null;
      }

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
      if (first && setActiveSchool) setActiveSchool(first as School);
      if (!opts.silent) {
        setLinkStatus(`Loaded ${charName ? charName + " – " : ""}${spells.length} verbal spells`);
        setTimeout(() => setLinkStatus(""), 2500);
      }
      return { characterId: charId, characterName: charName, spells };
    } catch (e: any) {
      const msg = String(e?.message || e);
      // Map to user-friendly messages per spec
      if (msg.includes("could not extract") || msg.includes("Could not parse") || msg.includes("Invalid URL")) {
        if (!opts.silent) setLinkStatus(`Invalid URL. Check carefully and try again`);
      } else if (msg.includes("character not found") || msg.includes("404") || msg.includes("No character")) {
        if (!opts.silent) setLinkStatus(`No character at that URL. Check URL carefully and try again.`);
      } else if (msg.includes("character is private") || msg.includes("private") || msg.includes("403")) {
        if (!opts.silent) setLinkStatus(`That character is private. Enable public sharing on dndbeyond and try again.`);
      } else if (msg.includes("timed out") || msg.includes("504") || msg.includes("dndbeyond timed out")) {
        if (!opts.silent) setLinkStatus(`dndbeyond timed out. Wait a moment and try again.`);
      } else if (msg.includes("proxy") || msg.includes("500") || msg.includes("Our dndbeyond.com proxy")) {
        if (!opts.silent) setLinkStatus(`Our dndbeyond.com proxy is having issues. Wait a moment and try again`);
      } else if (msg.includes("502") || msg.includes("dndbeyond.com is down") || msg.includes("upstream")) {
        if (!opts.silent) setLinkStatus(`dndbeyond.com is down or having issues. Wait a moment and try again.`);
      } else if (msg.includes("could not reach") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        if (!opts.silent) setLinkStatus(`dndbeyond.com is down or having issues. Wait a moment and try again.`);
      } else {
        if (!opts.silent) setLinkStatus(`Error: ${msg.slice(0, 200)}`);
      }
      return null;
    } finally {
      setIsLinking(false);
    }
  };

  const fetchCharacter = async (idOrUrl: string, opts: { silent?: boolean } = {}) => {
    return await fetchCharacterInternal(idOrUrl, opts);
  };

  const onSwitch = (cid: string) => {
    setActiveId(cid);
    const c = characters.find((ch) => ch.characterId === cid);
    if (c && setActiveSchool) {
      const first = SCHOOLS.find((s) => c.spells.some((sp) => sp.school === s));
      if (first) setActiveSchool(first as School);
    }
  };

  const onRemove = (cid: string, setPendingDeleteId: (id: string | null) => void) => {
    setPendingDeleteId(cid);
  };

  const confirmRemove = (cid: string, activeIdCurrent: string, setPendingDeleteId: (id: string | null) => void, extrasPerChar: any, setExtrasPerChar: any, schoolLangsPerChar: any, setSchoolLangsPerChar: any) => {
    const idx = characters.findIndex((c) => c.characterId === cid);
    if (idx < 0) {
      setPendingDeleteId(null);
      return;
    }
    const newChars = characters.filter((c) => c.characterId !== cid);
    setCharacters(newChars);
    setExtrasPerChar((prev: any) => {
      const copy = { ...prev };
      delete copy[cid];
      return copy;
    });
    setSchoolLangsPerChar((prev: any) => {
      const copy = { ...prev };
      delete copy[cid];
      return copy;
    });
    if (activeIdCurrent === cid) {
      if (newChars.length) {
        const next = newChars[Math.min(idx, newChars.length - 1)];
        setActiveId(next.characterId);
      } else {
        setActiveId("");
      }
    }
    if (newChars.length === 0) {
      try {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
      } catch {}
    }
    setPendingDeleteId(null);
  };

  return {
    characters,
    setCharacters,
    activeId,
    setActiveId,
    activeCharacter,
    spellsArr,
    grouped,
    fetchCharacter,
    fetchCharacterInternal,
    onSwitch,
    onRemove,
    confirmRemove,
    isLinking,
    linkStatus,
    setLinkStatus,
  };
}
