export const SCHOOLS = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
] as const;

export type School = (typeof SCHOOLS)[number];

export const SCHOOL_BY_ID: Record<number, School> = {
  1: "Abjuration",
  2: "Conjuration",
  3: "Divination",
  4: "Enchantment",
  5: "Evocation",
  6: "Illusion",
  7: "Necromancy",
  8: "Transmutation",
};
