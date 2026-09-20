// Table 3-174, Command Words and Magic Words, Tome of Adventure.
// Each row covers a 5-number d100 range: rows[0] = 01-05, rows[19] = 96-00.
export type MagicWordRow = {
  first: string;
  second: string;
  ending: string;
};

export type MagicWordTable = {
  id: string;
  rows: MagicWordRow[];
};

export const TOME_OF_ADVENTURE: MagicWordTable = {
  id: "tome-of-adventure",
  rows: [
    { first: "Bara", second: "bo", ending: "lis" },    // 01-05
    { first: "Mira", second: "bi", ending: "lune" },   // 06-10
    { first: "Abara", second: "ca", ending: "dabra" }, // 11-15
    { first: "Ocus", second: "po", ending: "sicus" },  // 16-20
    { first: "Dias", second: "coxi", ending: "po" },   // 21-25
    { first: "Lea", second: "sa", ending: "x" },       // 26-30
    { first: "Ro", second: "sixa", ending: "nda" },    // 31-35
    { first: "Sha", second: "loba", ending: "m" },     // 36-40
    { first: "Za", second: "za", ending: "n" },       // 41-45
    { first: "Ul", second: "pana", ending: "r" },      // 46-50
    { first: "O", second: "sci", ending: "rix" },      // 51-55
    { first: "Oca", second: "miri", ending: "pir" },   // 56-60
    { first: "Re", second: "da", ending: "la" },       // 61-65
    { first: "Lo", second: "paa", ending: "lion" },    // 66-70
    { first: "Ba", second: "tsa", ending: "xon" },      // 71-75
    { first: "Bo", second: "tua", ending: "cto" },     // 76-80
    { first: "Po", second: "soa", ending: "cta" },     // 81-85
    { first: "Mia", second: "mura", ending: "sta" },   // 86-90
    { first: "Acro", second: "a", ending: "sto" },     // 91-95
    { first: "A", second: "mi", ending: "nto" },       // 96-00
  ],
};
