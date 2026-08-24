import { onRequest } from "firebase-functions/v2/https";
import { SCHOOL_BY_ID } from "./lib/schools";

function normalizeSchool(raw: any): string {
  if (!raw) return "Evocation";
  if (typeof raw === "string") {
    const known = Object.values(SCHOOL_BY_ID);
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

type DdbSpellEntry = { name: string; school: string; level: number };
function collectSpells(char: any): DdbSpellEntry[] {
  const seen = new Set<string>();
  const out: DdbSpellEntry[] = [];
  const add = (defn: any) => {
    if (!defn || !hasVerbal(defn)) return;
    const name = (defn.name || "").toString().trim();
    if (!name) return;
    if (seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    out.push({
      name,
      school: normalizeSchool(defn.school),
      level: typeof defn.level === "number" ? defn.level : 0,
    });
  };
  if (Array.isArray(char.classSpells))
    for (const cs of char.classSpells) if (Array.isArray(cs?.spells)) for (const sp of cs.spells) add(sp?.definition);
  const spellsSection = char.spells;
  if (spellsSection && typeof spellsSection === "object" && !Array.isArray(spellsSection))
    for (const k of Object.keys(spellsSection))
      if (Array.isArray((spellsSection as any)[k])) for (const sp of (spellsSection as any)[k]) add(sp?.definition);
  if (Array.isArray(spellsSection)) for (const sp of spellsSection) add(sp?.definition || sp);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function countTotalSpells(char: any): number {
  const seen = new Set<string>();
  let n = 0;
  const add = (defn: any) => {
    if (!defn) return;
    const name = (defn.name || "").toString().trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    n++;
  };
  if (Array.isArray(char.classSpells))
    for (const cs of char.classSpells) if (Array.isArray(cs?.spells)) for (const sp of cs.spells) add(sp?.definition);
  const spellsSection = char.spells;
  if (spellsSection && typeof spellsSection === "object" && !Array.isArray(spellsSection))
    for (const k of Object.keys(spellsSection))
      if (Array.isArray((spellsSection as any)[k])) for (const sp of (spellsSection as any)[k]) add(sp?.definition);
  if (Array.isArray(spellsSection)) for (const sp of spellsSection) add(sp?.definition || sp);
  return n;
}

function extractIdFromRequest(req: any): string | null {
  const rawPath = (req.path as string) || (req.url as string) || "";
  const q = (req.query?.id as string) || (req.query?.characterId as string);
  if (q && /^\d+$/.test(q)) return q;
  const m1 = rawPath.match(/\/api\/dndbeyond\/(\d{5,})/i);
  if (m1) return m1[1];
  const m2 = rawPath.match(/\/(\d{5,})\/?(?:\?.*)?$/);
  if (m2) return m2[1];
  const m3 = rawPath.match(/(\d{5,})/);
  if (m3) return m3[1];
  return null;
}

export const dndbeyondProxy = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    concurrency: 40,
    cors: [
      "https://chants-506202.web.app",
      "https://chants-506202.firebaseapp.com",
      "http://localhost:3000",
    ],
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    const charId = extractIdFromRequest(req);
    if (!charId) {
      res.status(400).json({ error: "missing character id" });
      return;
    }
    if (!/^\d+$/.test(charId)) {
      res.status(400).json({ error: "invalid character id" });
      return;
    }
    const upstream = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const upstreamRes = await fetch(upstream, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "dnd-chants-firebase-proxy/1.0" },
        signal: controller.signal as any,
      });
      if (!upstreamRes.ok) {
        const txt = await upstreamRes.text().catch(() => "");
        if (upstreamRes.status === 404) {
          res.status(404).json({ error: "No character at that URL" });
          return;
        }
        if (upstreamRes.status === 403) {
          res.status(403).json({ error: "That character is private" });
          return;
        }
        res.status(502).json({ error: "dndbeyond.com is down or having issues" });
        return;
      }
      const raw = (await upstreamRes.json()) as any;
      const char = raw?.data ?? raw;
      if (!char || !char.name) {
        res.status(502).json({ error: "unexpected upstream shape" });
        return;
      }
      const spells = collectSpells(char);
      const rawTotal = countTotalSpells(char);
      let lastModifiedISO: string | null = null;
      const dm = char.dateModified ?? char.modified ?? char.updatedAt;
      if (typeof dm === "number") {
        const ms = dm > 1e12 ? dm : dm > 1e10 ? dm : dm * 1000;
        try {
          lastModifiedISO = new Date(ms).toISOString();
        } catch {}
      } else if (typeof dm === "string") {
        try {
          lastModifiedISO = new Date(dm).toISOString();
        } catch {
          lastModifiedISO = dm;
        }
      }
      res.set("Cache-Control", "public, max-age=60, s-maxage=120");
      res.status(200).json({
        characterId: String(char.id ?? charId),
        characterName: char.name,
        spells: spells.map((s) => ({ name: s.name, school: s.school })),
        lastModified: lastModifiedISO,
        fetchTime: new Date().toISOString(),
        totalSpells: spells.length,
        rawTotalSpells: rawTotal,
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("aborted") || e?.name === "AbortError") {
        res.status(504).json({ error: "dndbeyond timed out" });
        return;
      }
      res.status(500).json({ error: "Our dndbeyond.com proxy is having issues" });
    } finally {
      clearTimeout(timer);
    }
  }
);
