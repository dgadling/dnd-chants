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

export const SCHOOL_DEFAULTS: Record<School, string> = {
  Abjuration: "he",
  Conjuration: "is",
  Divination: "hi",
  Enchantment: "it",
  Evocation: "ru",
  Illusion: "ar",
  Necromancy: "la",
  Transmutation: "de",
};

export const LANG_OPTIONS: { code: string; label: string }[] = [
  { code: "af", label: "Afrikaans" },
  { code: "sq", label: "Albanian" },
  { code: "am", label: "Amharic" },
  { code: "ar", label: "Arabic" },
  { code: "hy", label: "Armenian" },
  { code: "az", label: "Azerbaijani" },
  { code: "eu", label: "Basque" },
  { code: "be", label: "Belarusian" },
  { code: "bn", label: "Bengali" },
  { code: "bs", label: "Bosnian" },
  { code: "bg", label: "Bulgarian" },
  { code: "ca", label: "Catalan" },
  { code: "ceb", label: "Cebuano" },
  { code: "ny", label: "Chichewa" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "zh-CN", label: "Chinese Simplified" },
  { code: "zh-TW", label: "Chinese Traditional" },
  { code: "co", label: "Corsican" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "eo", label: "Esperanto" },
  { code: "et", label: "Estonian" },
  { code: "tl", label: "Filipino" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "fy", label: "Frisian" },
  { code: "gl", label: "Galician" },
  { code: "ka", label: "Georgian" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "gu", label: "Gujarati" },
  { code: "ht", label: "Haitian Creole" },
  { code: "ha", label: "Hausa" },
  { code: "haw", label: "Hawaiian" },
  { code: "iw", label: "Hebrew (iw)" },
  { code: "he", label: "Hebrew (he)" },
  { code: "hi", label: "Hindi" },
  { code: "hmn", label: "Hmong" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "ig", label: "Igbo" },
  { code: "id", label: "Indonesian" },
  { code: "ga", label: "Irish" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "jw", label: "Javanese" },
  { code: "kn", label: "Kannada" },
  { code: "kk", label: "Kazakh" },
  { code: "km", label: "Khmer" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "ko", label: "Korean" },
  { code: "ku", label: "Kurdish (Kurmanji)" },
  { code: "ky", label: "Kyrgyz" },
  { code: "lo", label: "Lao" },
  { code: "la", label: "Latin" },
  { code: "lv", label: "Latvian" },
  { code: "lt", label: "Lithuanian" },
  { code: "lb", label: "Luxembourgish" },
  { code: "mk", label: "Macedonian" },
  { code: "mg", label: "Malagasy" },
  { code: "ms", label: "Malay" },
  { code: "ml", label: "Malayalam" },
  { code: "mt", label: "Maltese" },
  { code: "mi", label: "Maori" },
  { code: "mr", label: "Marathi" },
  { code: "mn", label: "Mongolian" },
  { code: "my", label: "Myanmar (Burmese)" },
  { code: "ne", label: "Nepali" },
  { code: "no", label: "Norwegian" },
  { code: "or", label: "Odia" },
  { code: "ps", label: "Pashto" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pa", label: "Punjabi" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sm", label: "Samoan" },
  { code: "gd", label: "Scots Gaelic" },
  { code: "sr", label: "Serbian" },
  { code: "st", label: "Sesotho" },
  { code: "sn", label: "Shona" },
  { code: "sd", label: "Sindhi" },
  { code: "si", label: "Sinhala" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "so", label: "Somali" },
  { code: "es", label: "Spanish" },
  { code: "su", label: "Sundanese" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "tg", label: "Tajik" },
  { code: "ta", label: "Tamil" },
  { code: "tt", label: "Tatar" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "tk", label: "Turkmen" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "ug", label: "Uyghur" },
  { code: "uz", label: "Uzbek" },
  { code: "vi", label: "Vietnamese" },
  { code: "cy", label: "Welsh" },
  { code: "xh", label: "Xhosa" },
  { code: "yi", label: "Yiddish" },
  { code: "yo", label: "Yoruba" },
  { code: "zu", label: "Zulu" },
];

export const TTS_LANG_MAP: Record<string, string> = {
  iw: "he-IL",
  he: "he-IL",
  is: "is-IS",
  hi: "hi-IN",
  it: "it-IT",
  ru: "ru-RU",
  ar: "ar-SA",
  la: "la",
  de: "de-DE",
  af: "af-ZA",
  sq: "sq-AL",
  am: "am-ET",
  hy: "hy-AM",
  az: "az-AZ",
  eu: "eu-ES",
  be: "be-BY",
  bn: "bn-BD",
  bs: "bs-BA",
  bg: "bg-BG",
  ca: "ca-ES",
  ceb: "ceb-PH",
  ny: "ny-MW",
  zh: "zh-CN",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  co: "co-FR",
  hr: "hr-HR",
  cs: "cs-CZ",
  da: "da-DK",
  nl: "nl-NL",
  en: "en-US",
  eo: "eo",
  et: "et-EE",
  tl: "fil-PH",
  fi: "fi-FI",
  fr: "fr-FR",
  fy: "fy-NL",
  gl: "gl-ES",
  ka: "ka-GE",
  el: "el-GR",
  gu: "gu-IN",
  ht: "ht-HT",
  ha: "ha-NG",
  haw: "haw-US",
  hmn: "hmn",
  hu: "hu-HU",
  ig: "ig-NG",
  id: "id-ID",
  ga: "ga-IE",
  ja: "ja-JP",
  jw: "jv-ID",
  kn: "kn-IN",
  kk: "kk-KZ",
  km: "km-KH",
  rw: "rw-RW",
  ko: "ko-KR",
  ku: "ku-TR",
  ky: "ky-KG",
  lo: "lo-LA",
  lv: "lv-LV",
  lt: "lt-LT",
  lb: "lb-LU",
  mk: "mk-MK",
  mg: "mg-MG",
  ms: "ms-MY",
  ml: "ml-IN",
  mt: "mt-MT",
  mi: "mi-NZ",
  mr: "mr-IN",
  mn: "mn-MN",
  my: "my-MM",
  ne: "ne-NP",
  no: "nb-NO",
  or: "or-IN",
  ps: "ps-AF",
  fa: "fa-IR",
  pl: "pl-PL",
  pt: "pt-PT",
  pa: "pa-IN",
  ro: "ro-RO",
  sm: "sm-WS",
  gd: "gd-GB",
  sr: "sr-RS",
  st: "st-ZA",
  sn: "sn-ZW",
  sd: "sd-PK",
  si: "si-LK",
  sk: "sk-SK",
  sl: "sl-SI",
  so: "so-SO",
  es: "es-ES",
  su: "su-ID",
  sw: "sw-KE",
  sv: "sv-SE",
  tg: "tg-TJ",
  ta: "ta-IN",
  tt: "tt-RU",
  te: "te-IN",
  th: "th-TH",
  tr: "tr-TR",
  tk: "tk-TM",
  uk: "uk-UA",
  ur: "ur-PK",
  ug: "ug-CN",
  uz: "uz-UZ",
  vi: "vi-VN",
  cy: "cy-GB",
  xh: "xh-ZA",
  yi: "yi",
  yo: "yo-NG",
  zu: "zu-ZA",
};

export function getSpeechLang(code: string): string {
  return TTS_LANG_MAP[code] || code;
}

export function getGoogleTl(code: string): string {
  const lc = code.toLowerCase().trim();
  if (lc === "he") return "iw";
  return lc;
}

export function getLangName(code: string): string {
  const found = LANG_OPTIONS.find((x) => x.code === code);
  if (!found) return code;
  let lbl = found.label;
  const suffix = ` (${code})`;
  if (lbl.endsWith(suffix)) lbl = lbl.slice(0, -suffix.length);
  return lbl;
}

export function getLangOptionDisplay(o: { code: string; label: string }): string {
  let lbl = o.label;
  const suffix = ` (${o.code})`;
  if (lbl.endsWith(suffix)) lbl = lbl.slice(0, -suffix.length);
  return lbl;
}

export function formatBox(native: string, roman: string): string {
  const n = (native || "").trim();
  if (!n) return "";
  const r = (roman || "").trim();
  if (r && r.toLowerCase() !== n.toLowerCase()) {
    return `${n} [${r}]`;
  }
  return n;
}

export function parseBox(s: string): { native: string; roman: string } {
  const trimmed = (s || "").trim();
  if (!trimmed) return { native: "", roman: "" };
  const m = trimmed.match(/^(.*?)(?:\s*\[([^\]]+)\])?\s*$/);
  if (!m) return { native: trimmed, roman: "" };
  const native = (m[1] || "").trim();
  const roman = (m[2] || "").trim();
  if (!native) return { native: trimmed, roman: "" };
  return { native, roman };
}
