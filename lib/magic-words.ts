import { TOME_OF_ADVENTURE } from "./tables/tome-of-adventure";
import type { MagicWordTable } from "./tables/tome-of-adventure";

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
  return { rolls, parts, word: parts[0] + parts[1] + parts[2] };
}
