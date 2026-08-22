/* client IDB audio cache – mem → IDB → proxy /api/tts → direct gtx → speechSynthesis fallback – SSR safe */
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

async function tryProxyTts(tl: string, q: string): Promise<Blob | null> {
  if (!isClient()) return null;
  const url = `/api/tts?tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "audio/mpeg" },
      signal: controller.signal as any,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryDirectTts(tl: string, q: string): Promise<Blob | null> {
  if (!isClient()) return null;
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(tl)}&client=gtx&q=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Referer: "https://translate.google.com/" } as any,
      signal: controller.signal as any,
      // @ts-ignore - referrer for static fetch
      referrer: "https://translate.google.com/",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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

  // 3. proxy /api/tts (same-origin, CORS-safe, cached locally after)
  try {
    const proxyBlob = await tryProxyTts(effectiveTl, trimmed);
    if (proxyBlob) {
      try {
        const dataUrl = await blobToDataUrl(proxyBlob);
        memAudioCache.set(key, dataUrl);
        await idbSet(key, dataUrl);
        if (typeof Audio !== "undefined") {
          const a = new Audio(dataUrl);
          currentAudio = a;
          await a.play();
          // also create objectUrl path for revoke parity if needed
          if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            const objectUrl = URL.createObjectURL(proxyBlob);
            setTimeout(() => {
              try { URL.revokeObjectURL(objectUrl); } catch {}
            }, 5000);
          }
          return;
        }
      } catch {
        // if dataUrl conversion fails, try objectUrl directly
        if (typeof URL !== "undefined" && typeof Audio !== "undefined") {
          const objectUrl = URL.createObjectURL(proxyBlob);
          try {
            const a = new Audio(objectUrl);
            currentAudio = a;
            await a.play();
            setTimeout(() => {
              try { URL.revokeObjectURL(objectUrl); } catch {}
            }, 5000);
            // still cache dataUrl async for next time
            blobToDataUrl(proxyBlob).then((du) => {
              memAudioCache.set(key, du);
              void idbSet(key, du);
            }).catch(() => {});
            return;
          } catch {
            try { URL.revokeObjectURL(objectUrl); } catch {}
          }
        }
      }
    }
  } catch {
    // fall through to direct
  }

  // 4. direct Google translate_tts fetch (may fail CORS on preview / web artifact)
  try {
    const directBlob = await tryDirectTts(effectiveTl, trimmed);
    if (directBlob) {
      try {
        if (typeof FileReader !== "undefined") {
          const dataUrl = await blobToDataUrl(directBlob);
          memAudioCache.set(key, dataUrl);
          await idbSet(key, dataUrl);
          if (typeof Audio !== "undefined") {
            const a = new Audio(dataUrl);
            currentAudio = a;
            await a.play();
            if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
              const objectUrl = URL.createObjectURL(directBlob);
              setTimeout(() => {
                try { URL.revokeObjectURL(objectUrl); } catch {}
              }, 5000);
            }
            return;
          }
        }
        if (typeof URL !== "undefined" && typeof Audio !== "undefined") {
          const objectUrl = URL.createObjectURL(directBlob);
          try {
            const a = new Audio(objectUrl);
            currentAudio = a;
            await a.play();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
            return;
          } catch {
            try { URL.revokeObjectURL(objectUrl); } catch {}
          }
        }
      } catch {
        // fall through
      }
    }
  } catch {
    // fall through to speechSynthesis
  }

  // 5. speechSynthesis fallback (client-only, no network, always cached via Web Speech)
  try {
    if (isClient() && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.lang = getSpeechLang(targetLang);
      window.speechSynthesis.speak(utter);
      return;
    }
  } catch {}
}
