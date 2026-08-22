/* client IDB audio cache – mem → IDB → server → speechSynthesis fallback like Space – SSR safe */
const DB_NAME = "dnd-chants-audio";
const STORE = "audio";
const DB_VERSION = 1;

const memAudioCache = new Map<string, string>();

function isClient(): boolean {
  return typeof window !== "undefined";
}

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isClient() || typeof indexedDB === "undefined" || !("indexedDB" in window)) {
      reject(new Error("no indexedDB"));
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e as Error);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openAudioDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, val: string): Promise<void> {
  try {
    const db = await openAudioDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore IDB errors
  }
}

let currentAudio: HTMLAudioElement | null = null;

export function cancelCurrentAudio(): void {
  try {
    if (isClient() && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {}
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {}
    currentAudio = null;
  }
}

export async function playCachedAudio(text: string, targetLang: string): Promise<void> {
  if (!isClient()) return;
  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) return;
  const { getGoogleTl, getSpeechLang } = await import("./lang");
  const effectiveTl = getGoogleTl(targetLang) || targetLang;
  const key = `${effectiveTl}|${trimmed.toLowerCase()}`;
  cancelCurrentAudio();

  // 1. mem cache (dataURL)
  const mem = memAudioCache.get(key);
  if (mem) {
    try {
      if (typeof Audio === "undefined") throw new Error("no Audio");
      const a = new Audio(mem);
      currentAudio = a;
      await a.play();
      return;
    } catch {
      // fall through
    }
  }

  // 2. IDB cache
  const idb = await idbGet(key);
  if (idb) {
    memAudioCache.set(key, idb);
    try {
      if (typeof Audio === "undefined") throw new Error("no Audio");
      const a = new Audio(idb);
      currentAudio = a;
      await a.play();
      return;
    } catch {
      // fall through
    }
  }

  // 3. direct Google translate_tts fetch (static, no /api/tts server)
  try {
    const q = encodeURIComponent(trimmed);
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(effectiveTl)}&client=gtx&q=${q}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { "Referer": "https://translate.google.com/" } as any,
        signal: controller.signal as any,
        // @ts-ignore - referrer for static fetch
        referrer: "https://translate.google.com/",
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) {
      const blob = await res.blob();
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        const objectUrl = URL.createObjectURL(blob);
        try {
          if (typeof FileReader !== "undefined") {
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            memAudioCache.set(key, dataUrl);
            await idbSet(key, dataUrl);
            if (typeof Audio !== "undefined") {
              const a = new Audio(dataUrl);
              currentAudio = a;
              await a.play();
              setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
              return;
            }
          }
          if (typeof Audio !== "undefined") {
            const a = new Audio(objectUrl);
            currentAudio = a;
            await a.play();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
            return;
          }
        } catch {
          if (typeof Audio !== "undefined") {
            const a = new Audio(objectUrl);
            currentAudio = a;
            await a.play().catch(()=>{});
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
            return;
          }
        }
      }
    }
  } catch {
    // fall through to speechSynthesis
  }

  // 4. speechSynthesis fallback (client-only, no network)
  try {
    if (isClient() && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.lang = getSpeechLang(targetLang);
      window.speechSynthesis.speak(utter);
      return;
    }
  } catch {}
}
