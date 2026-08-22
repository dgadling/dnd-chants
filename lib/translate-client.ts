/* client-side translate – gtx only, no API key, TTL 24h LRU MAX 500, static-safe */
import { getGoogleTl } from "./lang";

type CacheEntry = { translated: string; romanized: string; targetUsed: string; at: number };
const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 500;
const TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(source: string, target: string, lowerOrig: string) {
  return `${source}|${target}|${lowerOrig}`;
}

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.at > TTL_MS) cache.delete(k);
  }
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    if (!first) break;
    cache.delete(first);
  }
}

function isLatin(s: string): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  try {
    return /\p{Script=Latin}/u.test(t);
  } catch {
    return /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF\u00D0\u00F0\u00DE\u00FE]/.test(t);
  }
}

export async function translateClient(source: string, targetRaw: string, text: string): Promise<{ translated: string; romanized: string; targetUsed: string; cached?: boolean }> {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) throw new Error("text required");
  const src = (source || "en").toLowerCase().trim() || "en";
  const targetRawLc = (targetRaw || "ru").toLowerCase().trim() || "ru";
  const target = getGoogleTl(targetRawLc) || targetRawLc;
  const lowerOrig = trimmed.toLowerCase();
  const k = cacheKey(src, target, lowerOrig);
  evictExpired();
  const cached = cache.get(k);
  if (cached && Date.now() - cached.at <= TTL_MS) {
    return { translated: cached.translated, romanized: cached.romanized, targetUsed: cached.targetUsed, cached: true };
  } else if (cached) {
    cache.delete(k);
  }

  const sl = src;
  const tl = target;
  const gtl = getGoogleTl(tl) || tl;
  const encoded = encodeURIComponent(trimmed);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(gtl)}&dt=t&dt=rm&q=${encoded}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`gtx ${res.status}`);
    const json = (await res.json()) as any;
    if (!Array.isArray(json) || !Array.isArray(json[0])) throw new Error("unexpected gtx shape");
    const sentences = json[0] as any[];
    if (sentences.length === 0) throw new Error("empty gtx");
    let nativeOut = "";
    let romanOut = "";
    const distinctFromOrig = (s: string) => {
      const sl_ = s.toLowerCase().trim();
      if (sl_ === lowerOrig) return false;
      if (!sl_) return false;
      return true;
    };
    for (const seg of sentences) {
      if (!Array.isArray(seg)) continue;
      const t0 = typeof seg[0] === "string" ? seg[0] : "";
      if (t0) nativeOut += t0;
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
          // skip if same as native chunk
          if (t0 && vt.toLowerCase() === t0.toLowerCase().trim()) continue;
          cand = vt;
          break;
        }
      }
      if (cand) romanOut += cand + " ";
    }
    nativeOut = nativeOut.trim().replace(/\s+/g, " ").slice(0, 500);
    romanOut = romanOut.trim().replace(/\s+/g, " ").slice(0, 500);
    if (!nativeOut) throw new Error("gtx empty native");
    if (romanOut && romanOut.toLowerCase() === nativeOut.toLowerCase()) romanOut = "";
    evictExpired();
    cache.set(k, { translated: nativeOut, romanized: romanOut, targetUsed: target, at: Date.now() });
    return { translated: nativeOut, romanized: romanOut, targetUsed: target };
  } catch (e: any) {
    throw new Error(`translate failed (gtx down): ${String(e?.message || e).slice(0,200)}`);
  } finally {
    clearTimeout(timer);
  }
}
