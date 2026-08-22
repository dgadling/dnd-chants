"use client";
import pako from "pako";
import { getIdToken } from "@/lib/firebase-client";
import { STORAGE_BACKUP_KEY, deriveKeyFromPin, exportKeyToBase64, importKeyFromBase64, toBase64, fromBase64 } from "@/lib/backup-crypto";

export const STORAGE_BACKUP_ENABLED = "dnd-chant-backup-enabled";
export const STORAGE_LAST_BACKUP = "dnd-chant-last-backup";

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (typeof window !== "undefined" && origin === window.location.origin) return true;
  return origin === "https://chants-506202.web.app" || origin === "https://chants-506202.firebaseapp.com";
}

export async function backupToCloud(payload: any, uid: string, pin?: string) {
  const idToken = await getIdToken(); if (!idToken) throw new Error("Not signed in");
  let key: CryptoKey | null = null; try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
  if (!key) { if (!pin) throw new Error("PIN required"); key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); }
  const gz = pako.deflate(JSON.stringify(payload));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, gz as unknown as BufferSource);
  const resp = await fetch("/api/backup", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ iv: toBase64(iv), ciphertext: toBase64(ct), updatedAt: Date.now() }) });
  if (!resp.ok) throw new Error(`Backup failed ${resp.status}`); localStorage.setItem(STORAGE_LAST_BACKUP, new Date().toISOString()); return { iv: toBase64(iv), ciphertext: toBase64(ct) };
}

export async function restoreFromCloud(uid: string, pin?: string) {
  const idToken = await getIdToken(); if (!idToken) throw new Error("Not signed in");
  const resp = await fetch("/api/backup", { method: "GET", headers: { Authorization: `Bearer ${idToken}` } });
  if (resp.status === 404) throw new Error("No cloud backup found"); if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
  const j = await resp.json(); if (!j?.iv || !j?.ciphertext) throw new Error("Backup empty");
  let key: CryptoKey | null = null; try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
  if (!key) { if (!pin) throw new Error("PIN required"); key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); }
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(j.iv) as unknown as BufferSource }, key, fromBase64(j.ciphertext) as unknown as BufferSource);
    return JSON.parse(pako.inflate(new Uint8Array(plain), { to: "string" }) as any);
  } catch (e: any) { const m = String(e?.message||e); if (m.toLowerCase().includes("decrypt")||m.includes("OperationError")) throw new Error("Wrong PIN – decrypt failed"); throw e; }
}

export async function deleteCloudBackup() {
  const idToken = await getIdToken(); if (!idToken) throw new Error("Not signed in");
  const resp = await fetch("/api/backup", { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) throw new Error(`Delete failed ${resp.status}`); localStorage.removeItem(STORAGE_LAST_BACKUP);
}

export function disableBackupsLocal() {
  localStorage.removeItem(STORAGE_BACKUP_KEY); localStorage.removeItem(STORAGE_BACKUP_ENABLED); localStorage.removeItem(STORAGE_LAST_BACKUP);
  try { sessionStorage.removeItem("dnd-chant-pending-pin"); sessionStorage.removeItem("dnd-chant-discord-state"); } catch {}
}
