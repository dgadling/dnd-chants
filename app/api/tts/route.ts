import { NextResponse } from "next/server";
import { getGoogleTl, getSpeechLang } from "@/lib/lang";

const audioMemCache = new Map<string, { buf: ArrayBuffer; mime: string; at: number }>();
const MAX = 100;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const textRaw = (searchParams.get("text") || "").toString().trim().slice(0, 200);
  const targetRaw = (searchParams.get("target") || "").toString().trim().toLowerCase() || "ru";
  if (!textRaw) return NextResponse.json({ error: "text required" }, { status: 400 });

  const effectiveTl = getGoogleTl(targetRaw) || targetRaw;
  const cacheKey = `${effectiveTl}|${textRaw.toLowerCase()}`;

  const cached = audioMemCache.get(cacheKey);
  if (cached) {
    return new NextResponse(cached.buf, {
      headers: {
        "Content-Type": cached.mime,
        "Cache-Control": "public, max-age=86400",
        "X-Cache": "HIT",
      },
    });
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

    if (audioMemCache.size >= MAX) {
      const first = audioMemCache.keys().next().value;
      if (first) audioMemCache.delete(first);
    }
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
