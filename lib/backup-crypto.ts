export const STORAGE_BACKUP_KEY = "dnd-chant-backup-key";

// Worker-offloaded PBKDF2 600k to avoid 500ms main-thread freeze
// Fallback to direct derivation when Worker unavailable (SSR / tests)
async function deriveDirect(pin: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin) as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt) as unknown as BufferSource, iterations: 600000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function deriveKeyFromPin(pin: string, salt: string): Promise<CryptoKey> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return deriveDirect(pin, salt);
  }
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL("./workers/backup-crypto.worker.ts", import.meta.url));
      worker.onmessage = async (e: MessageEvent<{ raw?: ArrayBuffer; error?: string }>) => {
        if ((e.data as any)?.error) {
          worker.terminate();
          reject(new Error((e.data as any).error));
          return;
        }
        try {
          const raw = (e.data as any).raw as ArrayBuffer;
          const key = await crypto.subtle.importKey("raw", raw as unknown as BufferSource, "AES-GCM", true, [
            "encrypt",
            "decrypt",
          ]);
          resolve(key);
        } catch (err) {
          reject(err);
        } finally {
          worker.terminate();
        }
      };
      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };
      worker.postMessage({ pin, salt });
    } catch (err) {
      // If Worker construction fails (e.g. bundler), fallback to main thread
      deriveDirect(pin, salt).then(resolve).catch(reject);
    }
  });
}

export function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64(raw);
}

export async function importKeyFromBase64(b64: string): Promise<CryptoKey> {
  const raw = fromBase64(b64);
  return await crypto.subtle.importKey("raw", raw as unknown as BufferSource, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
