/* mem LRU 50 → IDB → proxy /api/tts → speechSynthesis – SSR safe */
const DB = "dnd-chants-audio";
const STORE = "audio";
const MAX = 50;
const mem = new Map<string, string>();

const isClient = () => typeof window !== "undefined";

function memSet(k: string, v: string) {
  if (mem.has(k)) mem.delete(k);
  else if (mem.size >= MAX) {
    const f = mem.keys().next().value as string | undefined;
    if (f) mem.delete(f);
  }
  mem.set(k, v);
}
function memGet(k: string) {
  const v = mem.get(k);
  if (v !== undefined) { mem.delete(k); mem.set(k, v); }
  return v;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (!isClient()) return rej(new Error("ssr"));
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e as Error); }
  });
}
async function idbGet(k: string): Promise<string | null> {
  try {
    const db = await openDB();
    return await new Promise((a, b) => {
      const tx = db.transaction(STORE, "readonly");
      const q = tx.objectStore(STORE).get(k);
      q.onsuccess = () => a((q.result as string) || null);
      q.onerror = () => b(q.error);
    });
  } catch { return null; }
}
async function idbSet(k: string, v: string) {
  try {
    const db = await openDB();
    await new Promise<void>((a, b) => {
      const tx = db.transaction(STORE, "readwrite");
      const q = tx.objectStore(STORE).put(v, k);
      q.onsuccess = () => a();
      q.onerror = () => b(q.error);
    });
  } catch {}
}

let cur: HTMLAudioElement | null = null;
export function cancelCurrentAudio() {
  try { if (isClient() && window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
  if (cur) { try { cur.pause(); cur.src = ""; } catch {} cur = null; }
}

function toDataUrl(b: Blob): Promise<string> {
  return new Promise((a, c) => {
    const fr = new FileReader();
    fr.onload = () => a(fr.result as string);
    fr.onerror = () => c(fr.error);
    fr.readAsDataURL(b);
  });
}
async function playOne(src: string) {
  if (typeof Audio === "undefined") throw new Error("no Audio");
  const a = new Audio(src);
  cur = a;
  await a.play();
}
async function proxyTl(tl: string, q: string): Promise<Blob | null> {
  if (!isClient()) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(`/api/tts?tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(q)}`, {
      signal: ac.signal as any,
    });
    if (!r.ok) return null;
    const b = await r.blob();
    return b && b.size ? b : null;
  } catch { return null; }
  finally { clearTimeout(t); }
}

export async function playCachedAudio(text: string, lang: string): Promise<boolean> {
  if (!isClient()) return false;
  const tr = text.trim().slice(0, 200);
  if (!tr) return false;
  const { getGoogleTl, getSpeechLang } = await import("./lang");
  const tl = getGoogleTl(lang) || lang;
  const key = `${tl}|${tr.toLowerCase()}`;
  cancelCurrentAudio();

  const m = memGet(key);
  if (m) { try { await playOne(m); return true; } catch {} }

  const idb = await idbGet(key);
  if (idb) { memSet(key, idb); try { await playOne(idb); return true; } catch {} }

  try {
    const bl = await proxyTl(tl, tr);
    if (bl) {
      const du = await toDataUrl(bl);
      memSet(key, du);
      void idbSet(key, du);
      await playOne(du);
      return true;
    }
  } catch {}

  try {
    if (isClient() && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
      const u = new SpeechSynthesisUtterance(tr);
      u.lang = getSpeechLang(lang);
      window.speechSynthesis.speak(u);
      return true;
    }
  } catch {}
  return false;
}
