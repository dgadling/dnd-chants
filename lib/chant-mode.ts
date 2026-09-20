import { TOME_OF_ADVENTURE } from "./tables/tome-of-adventure";

export type ChantMode = { mode: "lang" | "random"; table: string };

export const DEFAULT_CHANT_MODE: ChantMode = { mode: "lang", table: TOME_OF_ADVENTURE.id };

// Defensive parse of the stored dnd-chant-mode-v1 object: unknown mode
// strings fall back to "lang", missing/empty tables fall back to the Tome.
export function parseChantMode(raw: string | null): ChantMode {
  if (!raw) return DEFAULT_CHANT_MODE;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") {
      return {
        mode: p.mode === "random" ? "random" : "lang",
        table: typeof p.table === "string" && p.table ? p.table : TOME_OF_ADVENTURE.id,
      };
    }
  } catch {}
  return DEFAULT_CHANT_MODE;
}
