"use client";
import pako from "pako";
import { getIdToken } from "@/lib/firebase-client";
import { STORAGE_BACKUP_KEY, deriveKeyFromPin, exportKeyToBase64, importKeyFromBase64, toBase64, fromBase64 } from "@/lib/backup-crypto";

export const STORAGE_BACKUP_ENABLED = "dnd-chant-backup-enabled";
export const STORAGE_LAST_BACKUP = "dnd-chant-last-backup";
export const STORAGE_LAST_BACKUP_SIZE = "dnd-chant-last-backup-size";
export const STORAGE_LAST_CLOUD_ACTION = "dnd-chant-last-cloud-action";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n >= 10240 ? 0 : 1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function formatLocalTimestamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min} ${ampm}`;
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (typeof window !== "undefined" && origin === window.location.origin) return true;
  if (origin === "https://chants-506202.web.app" || origin === "https://chants-506202.firebaseapp.com") return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".web.app") || u.hostname.endsWith(".firebaseapp.com")) {
      if (u.hostname === "chants-506202.web.app" || u.hostname === "chants-506202.firebaseapp.com") return true;
      if (u.hostname.startsWith("chants-506202--")) return true;
    }
  } catch {}
  return false;
}

export async function backupToCloud(payload: any, uid: string, pin?: string) {
  const idToken = await getIdToken(); if (!idToken) throw new Error("Not signed in – Discord login required for backup");
  let key: CryptoKey | null = null; try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
  if (!key) { if (!pin) throw new Error("PIN required – enter 6-digit PIN to encrypt backup"); key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); }
  const gz = pako.deflate(JSON.stringify(payload));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, gz as unknown as BufferSource);
  const ct = ctBuf as ArrayBuffer;
  const resp = await fetch("/api/backup", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ iv: toBase64(iv), ciphertext: toBase64(ct) }) });
  let j: any; try { j = await resp.json(); } catch { throw new Error("Backup failed: server did not return JSON – check /api/backup rewrite and Hosting deploy"); }
  if (!resp.ok || !j?.ok) throw new Error(`Backup failed ${resp.status}: ${JSON.stringify(j).slice(0,200)}`);
  const now = new Date();
  localStorage.setItem(STORAGE_LAST_BACKUP, now.toISOString());
  try { localStorage.setItem(STORAGE_LAST_BACKUP_SIZE, String(ct.byteLength)); } catch {}
  return { iv: toBase64(iv), ciphertext: toBase64(ct), updatedAt: j.updatedAt || now.getTime(), size: ct.byteLength, at: now.toISOString() };
}

export async function restoreFromCloud(uid: string, pin?: string) {
  const idToken = await getIdToken(); if (!idToken) throw new Error("Not signed in – enable backups first");
  const resp = await fetch("/api/backup", { method: "GET", headers: { Authorization: `Bearer ${idToken}` } });
  if (resp.status === 404) throw new Error("No cloud backup found – click Backup now on another device first");
  let j: any; try { j = await resp.json(); } catch { throw new Error("Fetch backup failed: server did not return JSON"); }
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}: ${JSON.stringify(j).slice(0,200)}`);
  if (!j?.iv || !j?.ciphertext) throw new Error("Backup empty – no iv or ciphertext, click Backup now again");
  let key: CryptoKey | null = null; try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
  if (!key) { if (!pin) throw new Error("PIN required – same 6-digit PIN you used to enable backups"); key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); }
  const ctBytes = fromBase64(j.ciphertext) as unknown as ArrayBuffer;
  const ctSize = (ctBytes as ArrayBuffer).byteLength;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(j.iv) as unknown as BufferSource }, key, ctBytes as unknown as BufferSource);
    const parsed = JSON.parse(pako.inflate(new Uint8Array(plain), { to: "string" }) as any);
    return { data: parsed, size: ctSize };
  } catch (e: any) { const m = String(e?.message||e); if (m.toLowerCase().includes("decrypt")||m.includes("OperationError")) throw new Error("Wrong PIN – decrypt failed, try same PIN you used on other device"); throw e; }
}

export async function deleteCloudBackup() {
  const idToken = await getIdToken(); if (!idToken) throw new Error("Not signed in – cannot delete without Discord login");
  const resp = await fetch("/api/backup", { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
  let j: any; try { j = await resp.json(); } catch { throw new Error("Delete failed: server did not return JSON"); }
  if (!resp.ok || !j?.ok) throw new Error(`Delete failed ${resp.status}: ${JSON.stringify(j).slice(0,200)}`);
  localStorage.removeItem(STORAGE_LAST_BACKUP);
  try { localStorage.removeItem(STORAGE_LAST_BACKUP_SIZE); } catch {}
  try { localStorage.removeItem(STORAGE_LAST_CLOUD_ACTION); } catch {}
}

export function disableBackupsLocal() {
  localStorage.removeItem(STORAGE_BACKUP_KEY); localStorage.removeItem(STORAGE_BACKUP_ENABLED); localStorage.removeItem(STORAGE_LAST_BACKUP);
  try { localStorage.removeItem(STORAGE_LAST_BACKUP_SIZE); } catch {}
  try { localStorage.removeItem(STORAGE_LAST_CLOUD_ACTION); } catch {}
  try { sessionStorage.removeItem("dnd-chant-pending-pin"); sessionStorage.removeItem("dnd-chant-discord-state"); } catch {}
}
