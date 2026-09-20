import { describe, test, expect } from "bun:test";
import {
  rollD100,
  rowForRoll,
  rollMagicWord,
  assembleWord,
  sanitizeWord,
  generateMissingWords,
  getMagicWordTable,
  repairRandomWords,
} from "./magic-words";
import type { MagicWordEntry } from "./magic-words";
import { parseChantMode } from "./chant-mode";
import { MAX_MAGIC_WORD_LEN } from "./constants";

const table = getMagicWordTable("tome-of-adventure");

describe("rollD100", () => {
  test("maps raw buffer values and resamples at/above the rejection threshold", () => {
    // Rejection constant read from the do/while loop in rollD100 (lib/magic-words.ts).
    // The platform RNG is mocked here; only rollD100's own edge logic is under test.
    const REJECT_AT = 4294967200;
    const cryptoObj = globalThis.crypto as Crypto & { getRandomValues: Crypto["getRandomValues"] };
    const orig = cryptoObj.getRandomValues;
    const fill = (v: number) => {
      cryptoObj.getRandomValues = ((arr: Uint32Array) => {
        arr[0] = v;
        return arr;
      }) as typeof cryptoObj.getRandomValues;
    };
    try {
      fill(0);
      expect(rollD100()).toBe(1);

      fill(99);
      expect(rollD100()).toBe(100);

      let calls = 0;
      cryptoObj.getRandomValues = ((arr: Uint32Array) => {
        calls += 1;
        arr[0] = calls === 1 ? REJECT_AT : 7;
        return arr;
      }) as typeof cryptoObj.getRandomValues;
      expect(rollD100()).toBe(8);
      expect(calls).toBe(2);
    } finally {
      cryptoObj.getRandomValues = orig;
    }
  });
});

describe("rowForRoll", () => {
  test("roll 1 and 5 hit row 01-05", () => {
    expect(rowForRoll(table, 1)).toEqual({ first: "Bara", second: "bo", ending: "lis" });
    expect(rowForRoll(table, 5)).toEqual({ first: "Bara", second: "bo", ending: "lis" });
  });

  test("roll 96 and 100 hit row 96-00", () => {
    expect(rowForRoll(table, 96)).toEqual({ first: "A", second: "mi", ending: "nto" });
    expect(rowForRoll(table, 100)).toEqual({ first: "A", second: "mi", ending: "nto" });
  });
});

describe("table coverage", () => {
  test("20 rows cover exactly 1-100 with no gaps, no overlaps, and non-empty parts", () => {
    expect(table.rows).toHaveLength(20);
    const seen = new Set<number>();
    table.rows.forEach((row, i) => {
      for (let r = i * 5 + 1; r <= i * 5 + 5; r++) {
        expect(seen.has(r)).toBe(false);
        seen.add(r);
      }
      expect(row.first).not.toBe("");
      expect(row.second).not.toBe("");
      expect(row.ending).not.toBe("");
    });
    expect(seen.size).toBe(100);
  });
});

describe("rowForRoll boundary sweep", () => {
  test("every row's lowest and highest roll map to that row", () => {
    table.rows.forEach((row, i) => {
      expect(rowForRoll(table, i * 5 + 1)).toEqual(row);
      expect(rowForRoll(table, i * 5 + 5)).toEqual(row);
    });
  });
});

describe("assembleWord", () => {
  test('parts ["za","za","n"] give "zazan"', () => {
    expect(assembleWord(["za", "za", "n"])).toBe("zazan");
  });
});

describe("rollMagicWord", () => {
  test("word equals the joined parts", () => {
    for (let i = 0; i < 50; i++) {
      const e = rollMagicWord();
      expect(e.word).toBe(e.parts[0] + e.parts[1] + e.parts[2]);
      expect(e.word).toBe(assembleWord(e.parts));
    }
  });

  test("each part comes from the row of its own roll", () => {
    for (let i = 0; i < 50; i++) {
      const e = rollMagicWord();
      expect(e.parts[0]).toBe(rowForRoll(table, e.rolls[0]).first);
      expect(e.parts[1]).toBe(rowForRoll(table, e.rolls[1]).second);
      expect(e.parts[2]).toBe(rowForRoll(table, e.rolls[2]).ending);
    }
  });

  test("three fixed raw values land in three different rows", () => {
    // raw 0 -> roll 1 (row 01-05), raw 42 -> roll 43 (row 41-45),
    // raw 99 -> roll 100 (row 96-00). The mock mirrors the existing
    // rollD100 test; only rollMagicWord's wiring is under test here.
    const cryptoObj = globalThis.crypto as Crypto & { getRandomValues: Crypto["getRandomValues"] };
    const orig = cryptoObj.getRandomValues;
    const raws = [0, 42, 99];
    let i = 0;
    cryptoObj.getRandomValues = ((arr: Uint32Array) => {
      arr[0] = raws[i++];
      return arr;
    }) as typeof cryptoObj.getRandomValues;
    try {
      const e = rollMagicWord("tome-of-adventure");
      expect(e.rolls).toEqual([1, 43, 100]);
      expect(e.parts).toEqual(["Bara", "za", "nto"]);
      expect(e.word).toBe("Barazanto");
    } finally {
      cryptoObj.getRandomValues = orig;
    }
  });
});

describe("sanitizeWord", () => {
  test("blank and whitespace-only words are rejected", () => {
    expect(sanitizeWord("")).toBeNull();
    expect(sanitizeWord("   ")).toBeNull();
    expect(sanitizeWord("\t\n ")).toBeNull();
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeWord("  zazan  ")).toBe("zazan");
  });

  test("caps length at MAX_MAGIC_WORD_LEN", () => {
    const long = "x".repeat(MAX_MAGIC_WORD_LEN + 50);
    expect(sanitizeWord(long)).toBe("x".repeat(MAX_MAGIC_WORD_LEN));
  });
});

describe("generateMissingWords", () => {
  test("fills only missing or blank entries and never overwrites", () => {
    const kept = { rolls: [1, 1, 1] as [number, number, number], parts: ["Bara", "bo", "lis"] as [string, string, string], word: "Barabolis" };
    const input: Record<string, any> = {
      Fireball: kept,
      "Magic Missile": { rolls: [2, 2, 2], parts: ["Bara", "bo", "lis"], word: "   " },
    };
    const out = generateMissingWords(input, ["Fireball", "Magic Missile", "Shield"]);
    expect(out["Fireball"]).toBe(kept);
    expect(out["Magic Missile"]).not.toBe(input["Magic Missile"]);
    expect(out["Magic Missile"].word).toBeTruthy();
    expect(out["Magic Missile"].word).toBe(out["Magic Missile"].parts.join(""));
    expect(out["Shield"].word).toBeTruthy();
    expect(out["Shield"].word).toBe(assembleWord(out["Shield"].parts));
  });

  test("does not mutate the input record", () => {
    const input: Record<string, any> = {};
    generateMissingWords(input, ["Shield"]);
    expect(input["Shield"]).toBeUndefined();
  });
});

describe("repairRandomWords", () => {
  const validEntry = (word = "Barabolis") => ({
    rolls: [1, 43, 100] as [number, number, number],
    parts: ["Bara", "za", "nto"] as [string, string, string],
    word,
  });
  const badEntry = (word: string) => ({
    rolls: [0, 0, 0] as unknown as [number, number, number],
    parts: ["", "", ""] as [string, string, string],
    word,
  });

  test("placeholder and malformed rolls get fresh valid rolls, stored word kept", () => {
    const input: Record<string, Record<string, any>> = {
      c1: {
        Fireball: badEntry("Zazan"),
        Shield: { ...validEntry(), rolls: [1, 2] },
        "Magic Missile": { ...validEntry("Kept"), rolls: [1.5, 43, 101] },
        Counterspell: null,
      },
      c2: null,
    };
    const out = repairRandomWords(input as Record<string, Record<string, MagicWordEntry>>);
    expect(Object.keys(out).sort()).toEqual(["c1", "c2"]);
    expect(out.c2).toEqual({});
    for (const name of ["Fireball", "Shield", "Magic Missile", "Counterspell"]) {
      const e = out.c1[name];
      expect(e.rolls.every((r: number) => Number.isInteger(r) && r >= 1 && r <= 100)).toBe(true);
      expect(e.parts.every((p: string) => p)).toBe(true);
      expect(e.parts[0]).toBe(rowForRoll(table, e.rolls[0]).first);
      expect(e.parts[1]).toBe(rowForRoll(table, e.rolls[1]).second);
      expect(e.parts[2]).toBe(rowForRoll(table, e.rolls[2]).ending);
    }
    expect(out.c1["Fireball"].word).toBe("Zazan");
    expect(out.c1["Magic Missile"].word).toBe("Kept");
    expect(out.c1["Counterspell"].word).toBe("");
  });

  test("valid entries are kept by reference", () => {
    const kept = validEntry();
    const input = { c1: { Fireball: kept } };
    const out = repairRandomWords(input);
    expect(out.c1["Fireball"]).toBe(kept);
  });

  test("does not mutate the input record", () => {
    const input: Record<string, Record<string, any>> = {
      c1: { Fireball: badEntry("Zazan"), Shield: validEntry() },
    };
    const before = JSON.stringify(input);
    const out = repairRandomWords(input as Record<string, Record<string, MagicWordEntry>>);
    expect(out).not.toBe(input);
    expect(out.c1).not.toBe(input.c1);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("getMagicWordTable", () => {
  test("unknown table id falls back to the Tome of Adventure table", () => {
    expect(getMagicWordTable("no-such-table")).toBe(table);
  });
});

describe("parseChantMode", () => {
  const def = { mode: "lang", table: "tome-of-adventure" };

  test("garbage input falls back to defaults", () => {
    expect(parseChantMode(null)).toEqual(def);
    expect(parseChantMode(undefined as unknown as string | null)).toEqual(def);
    expect(parseChantMode("")).toEqual(def);
    expect(parseChantMode("not json")).toEqual(def);
    expect(parseChantMode("[1,2]")).toEqual(def);
    expect(parseChantMode(JSON.stringify("random"))).toEqual(def);
    expect(parseChantMode(JSON.stringify({ mode: "chaos", table: "tome-of-adventure" }))).toEqual(def);
  });

  test("missing or empty table falls back to the Tome table, valid mode kept", () => {
    expect(parseChantMode(JSON.stringify({ mode: "random" }))).toEqual({ mode: "random", table: "tome-of-adventure" });
    expect(parseChantMode(JSON.stringify({ mode: "random", table: "" }))).toEqual({ mode: "random", table: "tome-of-adventure" });
    expect(parseChantMode(JSON.stringify({ mode: "random", table: "tome-of-adventure" }))).toEqual({ mode: "random", table: "tome-of-adventure" });
  });
});
