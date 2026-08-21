export function transliterateRu(text: string): string {
  const map: Record<string, string> = {
    "А": "A", "а": "a",
    "Б": "B", "б": "b",
    "В": "V", "в": "v",
    "Г": "G", "г": "g",
    "Д": "D", "д": "d",
    "Е": "E", "е": "e",
    "Ё": "Yo", "ё": "yo",
    "Ж": "Zh", "ж": "zh",
    "З": "Z", "з": "z",
    "И": "I", "и": "i",
    "Й": "Y", "й": "y",
    "К": "K", "к": "k",
    "Л": "L", "л": "l",
    "М": "M", "м": "m",
    "Н": "N", "н": "n",
    "О": "O", "о": "o",
    "П": "P", "п": "p",
    "Р": "R", "р": "r",
    "С": "S", "с": "s",
    "Т": "T", "т": "t",
    "У": "U", "у": "u",
    "Ф": "F", "ф": "f",
    "Х": "Kh", "х": "kh",
    "Ц": "Ts", "ц": "ts",
    "Ч": "Ch", "ч": "ch",
    "Ш": "Sh", "ш": "sh",
    "Щ": "Shch", "щ": "shch",
    "Ъ": "", "ъ": "",
    "Ы": "Y", "ы": "y",
    "Ь": "", "ь": "",
    "Э": "E", "э": "e",
    "Ю": "Yu", "ю": "yu",
    "Я": "Ya", "я": "ya",
    "’": "", "ʼ": "", "ʹ": "", "ʺ": "",
  };
  let out = "";
  for (const ch of text) {
    if (map[ch] !== undefined) out += map[ch];
    else out += ch;
  }
  return out;
}

export function transliterateHi(text: string): string {
  const map: Record<string, string> = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "am", "अः": "ah",
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "़": "", "्": "",
    "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ँ": "n", "ं": "n", "ः": "h", "ॅ": "e", "ॉ": "o",
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
    "।": " ", "॥": " ",
  };
  let out = "";
  for (const ch of text) {
    if (map[ch] !== undefined) out += map[ch];
    else out += ch;
  }
  return out;
}

export function transliterateHe(text: string): string {
  const consMap: Record<string, string> = {
    "א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch", "ט": "t", "י": "y",
    "כ": "k", "ך": "k", "ל": "l", "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p", "ף": "p",
    "צ": "ts", "ץ": "ts", "ק": "k", "ר": "r", "ש": "sh", "ת": "t",
  };
  const vowelMap: Record<string, string> = {
    "\u05B0": "e",
    "\u05B1": "e",
    "\u05B2": "a",
    "\u05B3": "a",
    "\u05B4": "i",
    "\u05B5": "e",
    "\u05B6": "e",
    "\u05B7": "a",
    "\u05B8": "a",
    "\u05B9": "o",
    "\u05BA": "o",
    "\u05BB": "u",
  };
  const isHebBase = (c: string) => {
    const cp = c.charCodeAt(0);
    return cp >= 0x05D0 && cp <= 0x05EA;
  };
  const isMark = (c: string) => {
    const cp = c.charCodeAt(0);
    return cp >= 0x0591 && cp <= 0x05C7;
  };
  const outParts: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (isHebBase(ch)) {
      const marks: string[] = [];
      let j = i + 1;
      while (j < text.length && isMark(text[j]!)) {
        marks.push(text[j]!);
        j++;
      }
      if (ch === "ו" && marks.includes("\u05BC")) {
        const hasOtherVowel = marks.some((m) => vowelMap[m] !== undefined && m !== "\u05BC");
        if (!hasOtherVowel) {
          outParts.push("u");
          i = j;
          continue;
        }
      }
      const cons = consMap[ch] ?? ch;
      let vowel = "";
      for (const m of marks) {
        if (m === "\u05BC") continue;
        if (m === "\u05BF") continue;
        if (m === "\u05C1" || m === "\u05C2") continue;
        const code = m.charCodeAt(0);
        if (code >= 0x0591 && code <= 0x05AF) continue;
        if (code === 0x05BD) continue;
        if (vowelMap[m] !== undefined) {
          if (!vowel) vowel = vowelMap[m]!;
        }
      }
      if (vowel) outParts.push(cons + vowel);
      else outParts.push(cons);
      i = j;
    } else if (ch === "־" || ch === "\u05BE") {
      outParts.push("-");
      i++;
    } else if (ch === "׳" || ch === "״") {
      i++;
    } else if (isMark(ch)) {
      i++;
    } else {
      outParts.push(ch);
      i++;
    }
  }
  return outParts.join("");
}

export function transliterateAr(text: string): string {
  const map: Record<string, string> = {
    "ا": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
    "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k",
    "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y", "ى": "a", "ة": "a", "ء": "a", "ئ": "y", "ؤ": "w",
    "آ": "a", "أ": "a", "إ": "i", "لا": "la",
    "ً": "", "ٌ": "", "ٍ": "", "َ": "", "ُ": "", "ِ": "", "ّ": "", "ْ": "", "ٰ": "a", "ٓ": "", "ٔ": "", "ٕ": "",
    "ـ": "", "؟": "?", "،": ",",
  };
  let out = "";
  for (const ch of text) {
    if (map[ch] !== undefined) out += map[ch];
    else out += ch;
  }
  return out;
}

export function localTransliterate(native: string, tgt: string): string {
  const t = tgt.toLowerCase();
  if (t === "ru") return transliterateRu(native);
  if (t === "hi") return transliterateHi(native);
  if (t === "he" || t === "iw") return transliterateHe(native);
  if (t === "ar") return transliterateAr(native);
  return "";
}
