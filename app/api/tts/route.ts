import { NextResponse } from "next/server";
import { getGoogleTl, getSpeechLang } from "@/lib/lang";

const audioMemCache = new Map<string, { buf: ArrayBuffer; mime: string; at: number }>();
const MAX = 100;
const TTL_MS = 24 * 60 * 60 * 1000;

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of audioMemCache) {
    if (now - v.at > TTL_MS) audioMemCache.delete(k);
  }
  while (audioMemCache.size > MAX) {
    const first = audioMemCache.keys().next().value;
    if (!first) break;
    audioMemCache.delete(first);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const textRaw = (searchParams.get("text") || "").toString().trim().slice(0, 200);
  const targetRaw = (searchParams.get("target") || "").toString().trim().toLowerCase() || "ru";
  if (!textRaw) return NextResponse.json({ error: "text required" }, { status: 400 });

  const effectiveTl = getGoogleTl(targetRaw) || targetRaw;
  const cacheKey = `${effectiveTl}|${textRaw.toLowerCase()}`;

  evictExpired();
  const cached = audioMemCache.get(cacheKey);
  if (cached) {
    if (Date.now() - cached.at <= TTL_MS) {
      return new NextResponse(cached.buf, {
        headers: {
          "Content-Type": cached.mime,
          "Cache-Control": "public, max-age=86400",
          "X-Cache": "HIT",
        },
      });
    } else {
      audioMemCache.delete(cacheKey);
    }
  }

  const q = encodeURIComponent(textRaw);
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(effectiveTl)}&client=gtx&q=${q}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://translate.google.com/" },
      signal: controller.signal as any,
    });
    if (!res.ok) {
      clearTimeout(timer);
      return NextResponse.json({ error: `tts upstream ${res.status}` }, { status: 502 });
    }
    const mime = res.headers.get("content-type") || "audio/mpeg";
    const ab = await res.arrayBuffer();

    evictExpired();
    audioMemCache.set(cacheKey, { buf: ab, mime, at: Date.now() });

    return new NextResponse(ab, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Length": ab.byteLength.toString(),
        "X-Cache": "MISS",
        "X-Speech-Lang": getSpeechLang(targetRaw),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `tts fetch failed ${String(e?.message || e).slice(0, 200)}` }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
