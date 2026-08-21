import { NextResponse } from "next/server";
import { getGoogleTl } from "@/lib/lang";

type TranslateBody = { text?: string; source?: string; target?: string };

const cache = new Map<string, { translated: string; romanized: string; targetUsed: string; at: number }>();
const MAX_CACHE = 500;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h TTL - evict expired, prevents leak in Cloud Run instance memory

function cacheKey(source: string, target: string, lowerOrig: string) {
  return `${source}|${target}|${lowerOrig}`;
}

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.at > TTL_MS) cache.delete(k);
  }
  // Also enforce MAX with LRU (oldest first, Map insertion order)
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    if (!first) break;
    cache.delete(first);
  }
}

async function googleTranslateV2(source: string, target: string, text: string, apiKey: string): Promise<string> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source, target, format: "text" }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`translate v2 failed ${res.status}: ${errBody.slice(0, 500)}`);
  }
  const raw = (await res.json()) as any;
  const translated = raw?.data?.translations?.[0]?.translatedText;
  if (typeof translated !== "string") throw new Error("unexpected translate v2 shape");
  return translated;
}

async function fetchGtxPrimary(src: string, tgt: string, text: string): Promise<{ native: string; roman: string } | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const encoded = encodeURIComponent(trimmed);
  const sl = (src || "en").toLowerCase().trim() || "en";
  const tl = tgt.toLowerCase().trim();
  const gtl = getGoogleTl(tl) || tl;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(gtl)}&dt=t&dt=rm&q=${encoded}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { method: "GET", headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal as any });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (!Array.isArray(json) || !Array.isArray(json[0])) return null;
    const sentences = json[0] as any[];
    if (sentences.length === 0) return null;
    let nativeOut = "";
    let romanOut = "";
    const lowerOrig = trimmed.toLowerCase();
    for (const seg of sentences) {
      if (!Array.isArray(seg)) continue;
      const t0 = typeof seg[0] === "string" ? seg[0] : "";
      if (t0) nativeOut += t0;

      const isLatin = (s: string) => {
        if (typeof s !== "string") return false;
        const t = s.trim();
        if (!t) return false;
        // Check for Latin script including extended (Þ ð, diacritics) - not just A-Z
        // Use unicode property escape if available, fallback to extended range
        try {
          return /\p{Script=Latin}/u.test(t);
        } catch {
          return /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF\u00D0\u00F0\u00DE\u00FE]/.test(t);
        }
      };
      const distinctFromOrig = (s: string) => {
        const sl_ = s.toLowerCase().trim();
        if (sl_ === lowerOrig) return false;
        if (t0 && sl_ === t0.toLowerCase().trim()) return false;
        if (seg[1] && typeof seg[1] === "string" && sl_ === (seg[1] as string).toLowerCase().trim()) return false;
        return true;
      };

      let cand = "";
      if (seg.length > 2 && isLatin(seg[2] as any) && distinctFromOrig(seg[2] as string)) {
        cand = (seg[2] as string).trim();
      } else if (seg.length > 3 && isLatin(seg[3] as any) && distinctFromOrig(seg[3] as string)) {
        cand = (seg[3] as string).trim();
      } else {
        for (let i = seg.length - 1; i >= 0; i--) {
          const v = seg[i];
          if (typeof v !== "string") continue;
          const vt = v.trim();
          if (!vt) continue;
          if (!/[A-Za-z]/.test(vt)) continue;
          if (!distinctFromOrig(vt)) continue;
          cand = vt;
          break;
        }
      }
      if (cand) romanOut += cand + " ";
    }
    nativeOut = nativeOut.trim().replace(/\s+/g, " ").slice(0, 500);
    romanOut = romanOut.trim().replace(/\s+/g, " ").slice(0, 500);
    if (!nativeOut) return null;
    if (romanOut && romanOut.toLowerCase() === nativeOut.toLowerCase()) romanOut = "";
    return { native: nativeOut, roman: romanOut };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: TranslateBody;
  try {
    body = (await req.json()) as TranslateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const text = (body.text || "").toString().trim().slice(0, 500);
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  const source = (body.source || "en").toString().toLowerCase().trim() || "en";
  const targetRaw = (body.target || "ru").toString().toLowerCase().trim() || "ru";
  const target = getGoogleTl(targetRaw) || targetRaw;
  const lowerOrig = text.toLowerCase();

  const k = cacheKey(source, target, lowerOrig);
  evictExpired();
  const cached = cache.get(k);
  if (cached) {
    // Check TTL still valid
    if (Date.now() - cached.at <= TTL_MS) {
      return NextResponse.json({ translated: cached.translated, romanized: cached.romanized, targetUsed: cached.targetUsed, cached: true });
    } else {
      cache.delete(k);
    }
  }

  let native = "";
  let roman = "";

  const gtx = await fetchGtxPrimary(source, target, text);
  if (gtx) {
    native = gtx.native;
    roman = gtx.roman;
  }

  const apiKey = (process.env.GOOGLE_TRANSLATE_API_KEY || "").trim();
  if (!native && apiKey) {
    try {
      const v2 = await googleTranslateV2(source, target, text, apiKey);
      native = (v2 || "").trim().slice(0, 500);
    } catch {
      // ignore
    }
  }

  if (!native) {
    return NextResponse.json({ error: "translate failed (gtx down, no v2 key)" }, { status: 502 });
  }

  if (roman && roman.toLowerCase() === native.toLowerCase()) roman = "";

  evictExpired();
  cache.set(k, { translated: native, romanized: roman, targetUsed: target, at: Date.now() });

  return NextResponse.json({ translated: native, romanized: roman, targetUsed: target });
}
