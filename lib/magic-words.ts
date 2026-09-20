import { TOME_OF_ADVENTURE } from "./tables/tome-of-adventure";
import type { MagicWordTable } from "./tables/tome-of-adventure";
import { MAX_MAGIC_WORD_LEN } from "./constants";

export type { MagicWordTable, MagicWordRow } from "./tables/tome-of-adventure";

export type MagicWordEntry = {
  rolls: [number, number, number];
  parts: [string, string, string];
  word: string;
};

const TABLES: Record<string, MagicWordTable> = {
  [TOME_OF_ADVENTURE.id]: TOME_OF_ADVENTURE,
};

export function getMagicWordTable(id: string): MagicWordTable {
  return TABLES[id] || TOME_OF_ADVENTURE;
}

// Display widths of the Rolls and Parts cells, in characters. The Rolls
// column is bounded by the d100 domain (three 3-digit numbers joined with
// " · " separators); the Parts column is bounded by the longest first,
// second, and ending strings across the table's rows, joined the same way.
// Kept in sync with the `shown.rolls.join(" · ")` and `shown.parts.join(" · ")`
// rendering by construction.
export function randomColumnWidths(tableId: string = TOME_OF_ADVENTURE.id): { rolls: number; parts: number } {
  const sep = " · ";
  let maxFirst = 0;
  let maxSecond = 0;
  let maxEnding = 0;
  for (const row of getMagicWordTable(tableId).rows) {
    if (row.first.length > maxFirst) maxFirst = row.first.length;
    if (row.second.length > maxSecond) maxSecond = row.second.length;
    if (row.ending.length > maxEnding) maxEnding = row.ending.length;
  }
  return {
    rolls: String(100).length * 3 + sep.length * 2,
    parts: maxFirst + maxSecond + maxEnding + sep.length * 2,
  };
}

// Integer 1-100 from the platform CSPRNG.
export function rollD100(): number {
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
    // Reject to remove modulo bias: 2^32 % 100 = 96.
  } while (x >= 4294967200);
  return (x % 100) + 1;
}

export function rowForRoll(table: MagicWordTable, roll: number): MagicWordTable["rows"][number] {
  const idx = Math.min(table.rows.length - 1, Math.max(0, Math.floor((roll - 1) / 5)));
  return table.rows[idx];
}

export function rollMagicWord(tableId: string = TOME_OF_ADVENTURE.id): MagicWordEntry {
  const table = getMagicWordTable(tableId);
  const rolls: [number, number, number] = [rollD100(), rollD100(), rollD100()];
  const parts: [string, string, string] = [
    rowForRoll(table, rolls[0]).first,
    rowForRoll(table, rolls[1]).second,
    rowForRoll(table, rolls[2]).ending,
  ];
  return { rolls, parts, word: assembleWord(parts) };
}

// Repair stored random words whose rolls are not three ints 1-100 (e.g. old
// placeholder [0,0,0] entries): fresh rolls/parts, stored word kept.
// Returns a new record; the input record is not mutated.
export function repairRandomWords(
  parsed: Record<string, Record<string, MagicWordEntry>>,
  tableId: string = TOME_OF_ADVENTURE.id
): Record<string, Record<string, MagicWordEntry>> {
  const out: Record<string, Record<string, MagicWordEntry>> = {};
  for (const [charId, entries] of Object.entries(parsed)) {
    out[charId] = {};
    for (const [spell, entry] of Object.entries(entries || {})) {
      const rollsOk =
        entry &&
        Array.isArray(entry.rolls) &&
        entry.rolls.length === 3 &&
        entry.rolls.every((r) => Number.isInteger(r) && r >= 1 && r <= 100);
      out[charId][spell] = rollsOk
        ? entry
        : { ...rollMagicWord(tableId), word: entry?.word || "" };
    }
  }
  return out;
}

export function assembleWord(parts: [string, string, string]): string {
  return parts[0] + parts[1] + parts[2];
}

// Normalize a hand-edited Result field. Returns null when the input is
// blank or whitespace-only, which must never be stored.
export function sanitizeWord(input: string): string | null {
  const t = input.trim().slice(0, MAX_MAGIC_WORD_LEN);
  return t ? t : null;
}

function entryWordIsBlank(entry: MagicWordEntry | undefined): boolean {
  return !entry || !entry.word || !entry.word.trim();
}

// Roll a fresh entry for every spell that has no entry or a blank word.
// Existing non-blank words are kept untouched. Returns a new record; the
// input record is not mutated.
export function generateMissingWords(
  entries: Record<string, MagicWordEntry | undefined>,
  spellNames: string[],
  tableId: string = TOME_OF_ADVENTURE.id
): Record<string, MagicWordEntry> {
  const next: Record<string, MagicWordEntry> = { ...(entries as Record<string, MagicWordEntry>) };
  for (const name of spellNames) {
    if (entryWordIsBlank(next[name])) next[name] = rollMagicWord(tableId);
  }
  return next;
}
