import { describe, test, expect, beforeEach } from "bun:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  EXPORT_KEYS,
  buildExportSnapshot,
  validateImportSnapshot,
  applyImportSnapshot,
  exportFilename,
} from "./backup-file";
import { STORAGE_KEYS } from "./storage-keys";

// In-memory localStorage stub; validation must never touch it on failure.
class MemStorage {
  private map = new Map<string, string>();
  calls = { getItem: 0, setItem: 0, removeItem: 0, clear: 0 };
  getItem(k: string): string | null {
    this.calls.getItem += 1;
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.calls.setItem += 1;
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.calls.removeItem += 1;
    this.map.delete(k);
  }
  clear(): void {
    this.calls.clear += 1;
    this.map.clear();
  }
  seed(k: string, v: string): void {
    this.map.set(k, v);
  }
}

let store: MemStorage;
beforeEach(() => {
  store = new MemStorage();
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = store;
});

function makeValid() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: "2026-09-20T12:00:00.000Z",
    data: { [STORAGE_KEYS.CHARACTERS]: '[{"characterId":"1"}]', [STORAGE_KEYS.THEME]: "dark" },
  };
}

describe("EXPORT_KEYS", () => {
  test("contains exactly the chant data + UI preference keys, no secrets", () => {
    const got = [...EXPORT_KEYS];
    expect(got).toEqual([
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
    ]);
    const secrets = [STORAGE_KEYS.BACKUP_KEY, STORAGE_KEYS.PENDING_PIN, STORAGE_KEYS.STATE, STORAGE_KEYS.DISCORD_USER];
    for (const s of secrets) expect(got).not.toContain(s);
  });
});

describe("buildExportSnapshot + validateImportSnapshot", () => {
  test("round-trips a valid snapshot losslessly", () => {
    store.seed(STORAGE_KEYS.CHARACTERS, '[{"characterId":"1"}]');
    store.seed(STORAGE_KEYS.THEME, "dark");
    const snap = buildExportSnapshot(new Date("2026-09-20T12:00:00.000Z"));
    expect(snap.format).toBe(BACKUP_FORMAT);
    expect(snap.version).toBe(BACKUP_VERSION);
    expect(snap.exportedAt).toBe("2026-09-20T12:00:00.000Z");
    // JSON serialization is the file format: values survive verbatim.
    const fileText = JSON.stringify(snap);
    const res = validateImportSnapshot(JSON.parse(fileText));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual(snap.data);
      expect(res.data[STORAGE_KEYS.CHARACTERS]).toBe('[{"characterId":"1"}]');
      expect(res.data[STORAGE_KEYS.THEME]).toBe("dark");
      // Absent keys export as null.
      expect(res.data[STORAGE_KEYS.ACTIVE_ID]).toBeNull();
    }
  });

  test("rejects non-object input", () => {
    for (const bad of ["not json", 42, null, undefined, [1, 2]]) {
      const res = validateImportSnapshot(bad);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/JSON object|backup/i);
    }
  });

  test("rejects wrong format marker", () => {
    const res = validateImportSnapshot({ ...makeValid(), format: "other-backup" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(BACKUP_FORMAT);
  });

  test("rejects unsupported version", () => {
    const res = validateImportSnapshot({ ...makeValid(), version: 2 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("version");
  });

  test("rejects unknown keys", () => {
    const res = validateImportSnapshot({
      ...makeValid(),
      data: { ...makeValid().data, "dnd-chant-backup-key": "secret" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("dnd-chant-backup-key");
  });

  test("rejects mistyped values", () => {
    const res = validateImportSnapshot({
      ...makeValid(),
      data: { [STORAGE_KEYS.CHARACTERS]: 42 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(STORAGE_KEYS.CHARACTERS);
  });

  test("validation never writes to localStorage on failure", () => {
    const invalids: unknown[] = [
      "nope",
      { ...makeValid(), format: "x" },
      { ...makeValid(), version: 99 },
      { ...makeValid(), data: { nope: "x" } },
      { ...makeValid(), data: { [STORAGE_KEYS.CHARACTERS]: 1 } },
    ];
    for (const bad of invalids) {
      const before = { ...store.calls };
      validateImportSnapshot(bad);
      expect(store.calls.setItem).toBe(before.setItem);
      expect(store.calls.removeItem).toBe(before.removeItem);
      expect(store.calls.clear).toBe(before.clear);
    }
  });
});

describe("applyImportSnapshot", () => {
  test("writes string values verbatim via setItem", () => {
    applyImportSnapshot({
      [STORAGE_KEYS.CHARACTERS]: '[{"characterId":"7"}]',
      [STORAGE_KEYS.THEME]: "light",
    });
    expect(store.getItem(STORAGE_KEYS.CHARACTERS)).toBe('[{"characterId":"7"}]');
    expect(store.getItem(STORAGE_KEYS.THEME)).toBe("light");
    expect(store.calls.setItem).toBe(2);
  });

  test("removes keys that are null or absent from the file (REPLACE semantics)", () => {
    store.seed(STORAGE_KEYS.CHARACTERS, "old");
    store.seed(STORAGE_KEYS.THEME, "old");
    store.seed(STORAGE_KEYS.CHANT_MODE, "old");
    applyImportSnapshot({ [STORAGE_KEYS.THEME]: null });
    expect(store.getItem(STORAGE_KEYS.CHARACTERS)).toBeNull(); // absent -> removed
    expect(store.getItem(STORAGE_KEYS.THEME)).toBeNull(); // null -> removed
    expect(store.getItem(STORAGE_KEYS.CHANT_MODE)).toBeNull(); // absent -> removed
    // Loops all EXPORT_KEYS: 10 keys are absent or null, each one removed.
    expect(store.calls.removeItem).toBe(10);
    expect(store.calls.setItem).toBe(0);
  });

  test("never touches the 8 excluded keys, even when seeded", () => {
    const excluded = [
      STORAGE_KEYS.BACKUP_KEY,
      STORAGE_KEYS.PENDING_PIN,
      STORAGE_KEYS.STATE,
      STORAGE_KEYS.DISCORD_USER,
      STORAGE_KEYS.BACKUP_ENABLED,
      STORAGE_KEYS.LAST_BACKUP,
      STORAGE_KEYS.LAST_BACKUP_SIZE,
      STORAGE_KEYS.LAST_CLOUD_ACTION,
    ];
    for (const k of excluded) store.seed(k, "keep-me");
    applyImportSnapshot({
      [STORAGE_KEYS.CHARACTERS]: "x",
      [STORAGE_KEYS.THEME]: "dark",
    });
    for (const k of excluded) expect(store.getItem(k)).toBe("keep-me");
  });
});

describe("exportFilename", () => {
  test("uses local date", () => {
    const d = new Date(2026, 8, 20, 12, 0, 0); // Sep 20 2026 local
    expect(exportFilename(d)).toBe("dnd-chants-backup-2026-09-20.json");
  });
});
