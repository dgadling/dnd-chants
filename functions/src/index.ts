import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Gen2 DDB proxy – keeps site static except /api/dndbeyond/** rewrite
// Same hasVerbal + SCHOOL_BY_ID + normalizeSchool + collectSpells as client lib/dndbeyond-client.ts

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

type DdbSpellEntry = { name: string; school: string; level: number };

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

function extractIdFromRequest(req: any): string | null {
  // Firebase Hosting rewrite /api/dndbeyond/** -> function, path may be /api/dndbeyond/123 or /123 or /character/123
  const rawPath = (req.path as string) || (req.url as string) || "";
  const queryId = (req.query?.id as string) || (req.query?.characterId as string);
  if (queryId && /^\d+$/.test(queryId)) return queryId;

  // try /api/dndbeyond/155525394
  const m1 = rawPath.match(/\/api\/dndbeyond\/(\d{5,})/i);
  if (m1) return m1[1];
  const m2 = rawPath.match(/\/(\d{5,})\/?(?:\?.*)?$/);
  if (m2) return m2[1];
  // fallback: last numeric segment
  const m3 = rawPath.match(/(\d{5,})/);
  if (m3) return m3[1];
  return null;
}

export const ttsProxy = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 10,
    concurrency: 80,
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const tlRaw = (req.query?.tl as string) || (req.query?.target as string) || "";
    const qRaw = (req.query?.q as string) || (req.query?.text as string) || "";
    const ie = ((req.query?.ie as string) || "UTF-8").slice(0, 10);

    if (!tlRaw || !qRaw) {
      res.status(400).json({ error: "missing tl or q – use /api/tts?tl=iw&q=hello" });
      return;
    }
    if (!/^[a-z-]{2,10}$/i.test(tlRaw)) {
      res.status(400).json({ error: "invalid tl – 2-10 letters/hyphen" });
      return;
    }
    const qTrim = String(qRaw).trim().slice(0, 200);
    if (!qTrim) {
      res.status(400).json({ error: "empty q" });
      return;
    }

    const upstream = `https://translate.googleapis.com/translate_tts?ie=${encodeURIComponent(ie)}&tl=${encodeURIComponent(tlRaw)}&client=gtx&q=${encodeURIComponent(qTrim)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      logger.info("tts proxy fetch", { tl: tlRaw, qLen: qTrim.length });
      const upstreamRes = await fetch(upstream, {
        method: "GET",
        headers: {
          "Referer": "https://translate.google.com/",
          "User-Agent": "Mozilla/5.0 (compatible; dnd-chants-tts-proxy/1.0; +https://chants-506202.web.app)",
        },
        signal: controller.signal as any,
      });

      if (!upstreamRes.ok) {
        const txt = await upstreamRes.text().catch(() => "");
        logger.error("tts upstream error", { status: upstreamRes.status, body: txt.slice(0, 300) });
        res.status(502).json({ error: `tts upstream ${upstreamRes.status}: ${txt.slice(0, 200)}` });
        return;
      }

      const buf = Buffer.from(await upstreamRes.arrayBuffer());
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", "audio/mpeg");
      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.set("Content-Length", String(buf.length));
      res.status(200).send(buf);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("aborted") || e?.name === "AbortError") {
        res.status(504).json({ error: "tts fetch timed out" });
        return;
      }
      logger.error("tts proxy exception", { err: msg });
      res.status(502).json({ error: msg.slice(0, 400) });
    } finally {
      clearTimeout(timer);
    }
  }
);

export const dndbeyondProxy = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    concurrency: 40,
    cors: true, // allow direct browser fetch if needed, hosting rewrite is same-origin anyway
  },
  async (req, res) => {
    // CORS for direct calls (preview artifact etc) – also hosting rewrite is same-origin
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const charId = extractIdFromRequest(req);
    if (!charId) {
      logger.warn("missing id", { path: req.path, url: req.url, query: req.query });
      res.status(400).json({ error: "missing character id – use /api/dndbeyond/12345678 or /api/dndbeyond?id=12345678" });
      return;
    }
    if (!/^\d+$/.test(charId)) {
      res.status(400).json({ error: "invalid character id – numeric only" });
      return;
    }

    const upstream = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      logger.info("proxy fetch", { charId, upstream });
      const upstreamRes = await fetch(upstream, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "dnd-chants-firebase-proxy/1.0 (+https://chants-506202.web.app)",
        },
        signal: controller.signal as any,
      });

      if (!upstreamRes.ok) {
        const txt = await upstreamRes.text().catch(() => "");
        if (upstreamRes.status === 404) {
          res.status(404).json({ error: "character not found or private – enable public sharing in D&D Beyond" });
          return;
        }
        if (upstreamRes.status === 403) {
          res.status(403).json({ error: "character is private – enable public sharing in D&D Beyond" });
          return;
        }
        logger.error("upstream error", { status: upstreamRes.status, body: txt.slice(0, 500) });
        res.status(502).json({ error: `upstream ${upstreamRes.status}: ${txt.slice(0, 400)}` });
        return;
      }

      const raw = (await upstreamRes.json()) as any;
      const char = raw?.data ?? raw;
      if (!char || !char.name) {
        res.status(502).json({ error: "unexpected upstream shape – no character data" });
        return;
      }

      const spells = collectSpells(char);

      let lastModifiedISO: string | null = null;
      const dm = char.dateModified ?? char.modified ?? char.updatedAt;
      if (typeof dm === "number") {
        const ms = dm > 1e12 ? dm : dm > 1e10 ? dm : dm * 1000;
        try { lastModifiedISO = new Date(ms).toISOString(); } catch {}
      } else if (typeof dm === "string") {
        try { lastModifiedISO = new Date(dm).toISOString(); } catch { lastModifiedISO = dm; }
      }

      res.set("Cache-Control", "public, max-age=60, s-maxage=120"); // 1m browser, 2m CDN – sheet changes often
      res.status(200).json({
        characterId: String(char.id ?? charId),
        characterName: char.name,
        spells: spells.map(s => ({ name: s.name, school: s.school })),
        lastModified: lastModifiedISO,
        fetchTime: new Date().toISOString(),
        totalSpells: spells.length,
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("aborted") || e?.name === "AbortError") {
        res.status(504).json({ error: "fetch timed out – D&D Beyond character-service slow or unreachable" });
        return;
      }
      logger.error("proxy exception", { err: msg });
      res.status(500).json({ error: msg.slice(0, 400) });
    } finally {
      clearTimeout(timer);
    }
  }
);
