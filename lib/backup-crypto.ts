export const STORAGE_BACKUP_KEY = "dnd-chant-backup-key";

// Stronger PIN: PBKDF2 600k iterations OWASP, 500ms per try vs 100k 100ms, 6-digit 1M possibilities 5.7 days laptop vs 27 hours, fallback to 600k if libsodium not available
// Note: libsodium-wrappers Argon2id 500ms memory-hard GPU resistant would be ideal but webpack ESM issue with Next.js 14, using PBKDF2 600k stronger as acceptable trade-off for D&D data not financial
export async function deriveKeyFromPin(pin: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(pin) as unknown as BufferSource, "PBKDF2", false, ["deriveKey"]);
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt) as unknown as BufferSource, iterations: 600000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
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
