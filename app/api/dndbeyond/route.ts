import { NextResponse } from "next/server";

// Minimal DDB parsing – mirrors dndbeyond-parser.py logic
// DDB character v5 shape: { data: { id, name, dateModified, classes, classSpells, spells, ... } }

type DdbSpellEntry = {
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

function extractId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  // pure numeric id
  if (/^\d+$/.test(s)) return s;
  // url like https://www.dndbeyond.com/characters/12345678 or /profile/.../characters/...
  const m = s.match(/characters\/(\d{2,})/i);
  if (m) return m[1];
  // fallback any long numeric sequence 5+ digits
  const m2 = s.match(/(\d{5,})/);
  if (m2) return m2[1];
  return null;
}

function normalizeSchool(raw: any): string {
  if (!raw) return "Evocation";
  if (typeof raw === "string") {
    const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    // DDB sometimes returns "Abjuration" already
    const known = ["Abjuration","Conjuration","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];
    if (known.includes(raw)) return raw;
    if (known.includes(cap)) return cap;
    // numeric string?
    const num = Number(raw);
    if (!isNaN(num) && SCHOOL_BY_ID[num]) return SCHOOL_BY_ID[num];
    return "Evocation";
  }
  if (typeof raw === "number" && SCHOOL_BY_ID[raw]) return SCHOOL_BY_ID[raw];
  return "Evocation";
}

function hasVerbal(defn: any): boolean {
  const comps = defn.components;
  if (Array.isArray(comps)) return comps.includes(1);
  const desc = defn.componentsDescription;
  if (typeof desc === "string") return desc.includes("V");
  return true; // unknown -> keep
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

  // classSpells[].spells[].definition
  const classSpells = char.classSpells;
  if (Array.isArray(classSpells)) {
    for (const cs of classSpells) {
      const spells = cs?.spells;
      if (!Array.isArray(spells)) continue;
      for (const sp of spells) {
        add(sp?.definition);
      }
    }
  }

  // spells dict: race, class, feat, item, background
  const spellsSection = char.spells;
  if (spellsSection && typeof spellsSection === "object" && !Array.isArray(spellsSection)) {
    for (const key of Object.keys(spellsSection)) {
      const list = (spellsSection as any)[key];
      if (!Array.isArray(list)) continue;
      for (const sp of list) {
        add(sp?.definition);
      }
    }
  }

  // Some sheets have spells in data.spells as array (older format) – handle
  if (Array.isArray(spellsSection)) {
    for (const sp of spellsSection) add(sp?.definition || sp);
  }

  // Sort alphabetically for stable UI
  out.sort((a,b)=>a.name.localeCompare(b.name));
  return out;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json – expected {urlOrId}" }, { status: 400 });
  }
  const urlOrId = (body.urlOrId || body.url || body.id || "").toString();
  const charId = extractId(urlOrId);
  if (!charId) {
    return NextResponse.json({ error: "could not extract character id – paste D&D Beyond URL like https://www.dndbeyond.com/characters/12345678 or numeric id" }, { status: 400 });
  }

  const fetchUrl = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; dnd-chants/1.0)",
        "Accept": "application/json",
      },
      signal: controller.signal as any,
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=> "");
      if (res.status === 404) {
        return NextResponse.json({ error: "character not found or private – enable public sharing in D&D Beyond and check id" , characterId: charId, upstreamStatus: res.status }, { status: 404 });
      }
      if (res.status === 403) {
        return NextResponse.json({ error: "character is private – enable public sharing in D&D Beyond", characterId: charId, upstreamStatus: res.status }, { status: 403 });
      }
      return NextResponse.json({ error: `upstream ${res.status}: ${txt.slice(0,400)}`, characterId: charId }, { status: 502 });
    }
    const raw = await res.json() as any;
    const char = raw?.data ?? raw;
    if (!char || !char.name) {
      return NextResponse.json({ error: "unexpected upstream shape – no character data", characterId: charId }, { status: 502 });
    }

    const spells = collectSpells(char);

    // dateModified may be timestamp number (ms) or ISO string or nested
    let lastModifiedISO: string | null = null;
    const dm = char.dateModified ?? char.modified ?? char.updatedAt;
    if (typeof dm === "number") {
      // DDB sometimes uses epoch ms or seconds – guess ms if > 1e12 else *1000
      const ms = dm > 1e12 ? dm : dm > 1e10 ? dm : dm * 1000;
      try { lastModifiedISO = new Date(ms).toISOString(); } catch {}
    } else if (typeof dm === "string") {
      try { lastModifiedISO = new Date(dm).toISOString(); } catch { lastModifiedISO = dm; }
    }

    return NextResponse.json({
      characterId: String(char.id ?? charId),
      characterName: char.name,
      spells: spells.map(s=>({ name: s.name, school: s.school })),
      lastModified: lastModifiedISO,
      fetchTime: new Date().toISOString(),
      totalSpells: spells.length,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("aborted") || e?.name === "AbortError") {
      return NextResponse.json({ error: "fetch timed out – D&D Beyond character-service slow or unreachable", characterId: charId }, { status: 504 });
    }
    return NextResponse.json({ error: `fetch failed: ${msg.slice(0,400)}`, characterId: charId }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
