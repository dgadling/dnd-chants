"use client";
import { STORAGE_KEYS } from "./storage-keys";

export const BACKUP_FORMAT = "dnd-chants-backup" as const;
export const BACKUP_VERSION = 1;

// Export key list: chant data + UI preferences, read verbatim from localStorage.
// Deliberately EXCLUDED:
// - BACKUP_KEY: derived encryption key, must never be written to a plaintext file
// - PENDING_PIN: ephemeral, single-use
// - STATE: discord OAuth state, ephemeral
// - DISCORD_USER: auth data, not chant data
// - BACKUP_ENABLED, LAST_BACKUP, LAST_BACKUP_SIZE, LAST_CLOUD_ACTION:
//   cloud-sync metadata; restoring them could confuse sync state.
export const EXPORT_KEYS = [
  STORAGE_KEYS.CHARACTERS,
  STORAGE_KEYS.ACTIVE_ID,
  STORAGE_KEYS.DDB_LINK,
  STORAGE_KEYS.SCHOOL_LANGS,
  STORAGE_KEYS.EXTRAS,
  STORAGE_KEYS.RANDOM,
  STORAGE_KEYS.CHANT_MODE,
  STORAGE_KEYS.HELP_TEMPLATE,
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.WELCOME,
] as const;

export type ExportSnapshot = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Record<string, string | null>;
};

export function buildExportSnapshot(now: Date = new Date()): ExportSnapshot {
  const data: Record<string, string | null> = {};
  for (const key of EXPORT_KEYS) {
    let v: string | null = null;
    try {
      v = localStorage.getItem(key);
    } catch {
      v = null;
    }
    data[key] = v;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function validateImportSnapshot(
  parsed: unknown
): { ok: true; data: Record<string, string | null> } | { ok: false; error: string } {
  if (!isPlainObject(parsed)) return { ok: false, error: "File is not a backup: expected a JSON object." };
  if (parsed.format !== BACKUP_FORMAT)
    return { ok: false, error: `Wrong backup format: expected "${BACKUP_FORMAT}".` };
  if (parsed.version !== BACKUP_VERSION)
    return {
      ok: false,
      error: `Unsupported backup version ${String(parsed.version)}: this app reads version ${BACKUP_VERSION}.`,
    };
  if (!isPlainObject(parsed.data)) return { ok: false, error: "Backup is corrupt: 'data' must be an object." };
  const allowed = new Set<string>(EXPORT_KEYS);
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (!allowed.has(k)) return { ok: false, error: `Unknown key in backup: "${k}".` };
    if (typeof v !== "string" && v !== null)
      return { ok: false, error: `Bad value for key "${k}": expected a string or null.` };
    out[k] = v;
  }
  return { ok: true, data: out };
}

// True REPLACE of the chant stores: keys with string values are written,
// keys that are null or absent from the file are removed. Excluded keys
// (auth, secrets, cloud metadata) are never touched.
export function applyImportSnapshot(data: Record<string, string | null>): void {
  for (const key of EXPORT_KEYS) {
    try {
      if (!(key in data) || data[key] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, data[key] as string);
    } catch {
      // storage unavailable; nothing more to do
    }
  }
}

// Page refresh after a restore. The caller layer owns this side effect:
// applyImportSnapshot is pure storage-write logic and never reloads.
export function reloadSoon(delayMs = 500): void {
  setTimeout(() => window.location.reload(), delayMs);
}

export function exportFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `dnd-chants-backup-${y}-${m}-${d}.json`;
}

export function downloadJson(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
