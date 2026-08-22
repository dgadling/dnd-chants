/* client-side DDB fetching – prefers same-origin /api/dndbeyond proxy (Firebase Functions) to avoid CORS, fallback to direct */
export type DdbSpellEntry = {
  name: string;
  school: string;
  level: number;
};

const SCHOOL_BY_ID: Record<number, string> = {
  1: "Abjuration",
  2: "Conjuration",
  3: "Divination",
  4: "Enchantment",
  5: "Evocation",
  6: "Illusion",
  7: "Necromancy",
  8: "Transmutation",
};

export function extractId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/characters\/(\d{2,})/i);
  if (m) return m[1];
  const m2 = s.match(/(\d{5,})/);
  if (m2) return m2[1];
  return null;
}

function normalizeSchool(raw: any): string {
  if (!raw) return "Evocation";
  if (typeof raw === "string") {
    const known = ["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];
    if (known.includes(raw)) return raw;
    const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (known.includes(cap)) return cap;
    const num = Number(raw);
    if (!isNaN(num) && SCHOOL_BY_ID[num]) return SCHOOL_BY_ID[num];
    return "Evocation";
  }
  if (typeof raw === "number" && SCHOOL_BY_ID[raw]) return SCHOOL_BY_ID[raw];
  return "Evocation";
}

function hasVerbal(defn: any): boolean {
  const comps = defn?.components;
  if (Array.isArray(comps)) return comps.includes(1);
  const desc = defn?.componentsDescription;
  if (typeof desc === "string") return desc.includes("V");
  return true;
}

function collectSpells(char: any): DdbSpellEntry[] {
  const seen = new Set<string>();
  const out: DdbSpellEntry[] = [];
  const add = (defn: any) => {
    if (!defn) return;
    if (!hasVerbal(defn)) return;
    const name = (defn.name || "").toString().trim();
    if (!name) return;
    if (seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const school = normalizeSchool(defn.school);
    const level = typeof defn.level === "number" ? defn.level : 0;
    out.push({ name, school, level });
  };
  const classSpells = char.classSpells;
  if (Array.isArray(classSpells)) {
    for (const cs of classSpells) {
      const spells = cs?.spells;
      if (!Array.isArray(spells)) continue;
      for (const sp of spells) add(sp?.definition);
    }
  }
  const spellsSection = char.spells;
  if (spellsSection && typeof spellsSection === "object" && !Array.isArray(spellsSection)) {
    for (const key of Object.keys(spellsSection)) {
      const list = (spellsSection as any)[key];
      if (!Array.isArray(list)) continue;
      for (const sp of list) add(sp?.definition);
    }
  }
  if (Array.isArray(spellsSection)) {
    for (const sp of spellsSection) add(sp?.definition || sp);
  }
  out.sort((a,b)=>a.name.localeCompare(b.name));
  return out;
}

async function tryProxyFetch(charId: string): Promise<any | null> {
  // same-origin proxy via Firebase Hosting rewrite -> Functions dndbeyondProxy
  // works on https://chants-506202.web.app and localhost when emulated, not on web artifact preview origin
  if (typeof window === "undefined") return null;
  const proxyUrls = [
    `/api/dndbeyond/${charId}`,
    `/api/dndbeyond?id=${charId}`,
  ];
  for (const u of proxyUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(u, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal as any });
      clearTimeout(timer);
      if (!res.ok) continue;
      const j = await res.json() as any;
      // proxy returns shape {characterId, characterName, spells, lastModified, fetchTime, totalSpells}
      if (j && j.spells && Array.isArray(j.spells)) return { fromProxy: true, data: j };
      // if proxy returned raw char (fallback), handle below
      if (j && (j.data || j.name)) return { fromProxy: false, raw: j };
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchCharacterClient(idOrUrl: string): Promise<{
  characterId: string;
  characterName: string;
  spells: { name: string; school: string }[];
  lastModified: string | null;
  fetchTime: string;
  totalSpells: number;
}> {
  const charId = extractId(idOrUrl);
  if (!charId) throw new Error("could not extract character id – paste D&D Beyond URL like https://www.dndbeyond.com/characters/12345678 or numeric id");

  // 1. Try same-origin proxy first (avoids CORS)
  try {
    const proxied = await tryProxyFetch(charId);
    if (proxied && proxied.fromProxy && proxied.data) {
      const j = proxied.data;
      return {
        characterId: String(j.characterId || charId),
        characterName: j.characterName || j.name || "",
        spells: (j.spells || []).map((s: any) => ({ name: s.name, school: s.school })),
        lastModified: j.lastModified || null,
        fetchTime: j.fetchTime || new Date().toISOString(),
        totalSpells: j.totalSpells ?? j.spells?.length ?? 0,
      };
    }
  } catch {
    // fall through to direct
  }

  // 2. Fallback direct browser fetch (will be blocked by CORS on most origins – kept for local dev / artifact preview with mock)
  const fetchUrl = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal as any,
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=> "");
      if (res.status === 404) throw new Error("character not found or private – enable public sharing in D&D Beyond");
      if (res.status === 403) throw new Error("character is private – enable public sharing in D&D Beyond (D&D Beyond blocks direct browser fetch – if this persists you may need a proxy)");
      throw new Error(`upstream ${res.status}: ${txt.slice(0,400)} – D&D Beyond may block CORS, try again or use proxy`);
    }
    const raw = await res.json() as any;
    const char = raw?.data ?? raw;
    if (!char || !char.name) throw new Error("unexpected upstream shape – no character data");
    const spells = collectSpells(char);
    let lastModifiedISO: string | null = null;
    const dm = char.dateModified ?? char.modified ?? char.updatedAt;
    if (typeof dm === "number") {
      const ms = dm > 1e12 ? dm : dm > 1e10 ? dm : dm * 1000;
      try { lastModifiedISO = new Date(ms).toISOString(); } catch {}
    } else if (typeof dm === "string") {
      try { lastModifiedISO = new Date(dm).toISOString(); } catch { lastModifiedISO = dm; }
    }
    return {
      characterId: String(char.id ?? charId),
      characterName: char.name,
      spells: spells.map(s=>({ name: s.name, school: s.school })),
      lastModified: lastModifiedISO,
      fetchTime: new Date().toISOString(),
      totalSpells: spells.length,
    };
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("aborted") || e?.name === "AbortError") throw new Error("fetch timed out – D&D Beyond character-service slow or unreachable");
    throw new Error(msg.slice(0,400));
  } finally {
    clearTimeout(timer);
  }
}
