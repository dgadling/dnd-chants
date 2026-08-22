"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBox, parseBox, getLangName } from "@/lib/lang";
import { playCachedAudio } from "@/lib/audio";
import { translateClient } from "@/lib/translate-client";

type Spell = {
  name: string;
  school: string;
};

type Props = {
  spell: Spell;
  targetLang: string;
  school: string;
  initialInput: string;
  initialNative: string;
  initialRoman: string;
  onSave?: (englishPhrase: string, native: string, roman: string) => void;
};

export function DesktopRow(props: Props) {
  const { spell, targetLang, school, initialInput, initialNative, initialRoman, onSave } = props;
  const [input, setInput] = useState(initialInput || "");
  const [boxText, setBoxText] = useState(() => formatBox(initialNative, initialRoman));
  const [isTranslating, setIsTranslating] = useState(false);
  const [transError, setTransError] = useState<string>("");
  const lastTranslatedRef = useRef<string>("");

  // sync input when preload arrives
  useEffect(() => {
    if (initialInput && initialInput !== input) {
      setInput(initialInput);
    }
  }, [initialInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialNative && !boxText.trim()) {
      setBoxText(formatBox(initialNative, initialRoman));
    }
  }, [initialNative, initialRoman]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parseBox(boxText);
  const effectiveNative = parsed.native;
  const effectiveRoman = parsed.roman;

  const autosave = useCallback((enPhrase: string, nat: string, rom: string) => {
    if (!onSave) return;
    const ep = enPhrase.trim().slice(0, 500);
    const n = nat.slice(0, 1000);
    const r = rom.slice(0, 1000);
    if (!ep && !n) return;
    onSave(ep, n, r);
  }, [onSave]);

  const handleInputChange = (v: string) => {
    setInput(v);
    autosave(v, effectiveNative, effectiveRoman);
  };

  const handleBoxChange = (v: string) => {
    setBoxText(v);
    const p = parseBox(v);
    autosave(input, p.native, p.roman);
  };

  const handleTranslate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (norm === lastTranslatedRef.current && effectiveNative) return;
    if (norm === lastTranslatedRef.current && isTranslating) return;
    setIsTranslating(true);
    setTransError("");
    try {
      const j = await translateClient("en", targetLang, trimmed);
      const newNative = (j.translated as string || "").slice(0, 500);
      const newRoman = (j.romanized as string || "").slice(0, 500);
      const formatted = formatBox(newNative, newRoman);
      setBoxText(formatted);
      autosave(trimmed, newNative, newRoman);
      lastTranslatedRef.current = norm;
    } catch (e: any) {
      setTransError(String(e?.message || e).slice(0, 80));
    } finally {
      setIsTranslating(false);
    }
  }, [input, targetLang, effectiveNative, isTranslating, autosave]);

  const handlePlay = useCallback(() => {
    const toSpeak = effectiveNative;
    if (!toSpeak) return;
    void playCachedAudio(toSpeak, targetLang);
  }, [effectiveNative, targetLang]);

  const handleIdiom = useCallback(() => {
    const langName = getLangName(targetLang);
    const q = `Help me come up with a short chant or idiom for the Dungeons & Dragons spell ${spell.name} in ${langName} that would sound reasonable to a native speaker.`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "popup,width=900,height=700");
  }, [spell.name, targetLang]);

  return (
    <tr className="border-b border-zinc-700 align-top">
      <td className="py-2 px-2 text-sm font-medium text-zinc-100 whitespace-nowrap max-w-[9rem] truncate">
        {spell.name}
      </td>
      <td className="py-2 px-2 min-w-[11rem]">
        <input
          aria-label={`Try phrasing for ${spell.name}`}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="try phrasing"
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) handleTranslate();
          }}
        />
      </td>
      <td className="py-2 px-1">
        <button
          aria-label={`Translate ${spell.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-400 text-black text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-amber-300"
          disabled={!input.trim() || isTranslating}
          onClick={handleTranslate}
          type="button"
          title={transError || "Translate"}
        >
          {isTranslating ? "…" : "▶"}
        </button>
      </td>
      <td className="py-2 px-2 text-sm text-zinc-100 max-w-[16rem] min-w-[10rem]">
        <input
          aria-label={`Translation for ${spell.name}`}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[13px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-zinc-500"
          value={boxText}
          onChange={(e) => handleBoxChange(e.target.value)}
          placeholder="native [roman]"
        />
        {transError ? (
          <div className="mt-1 text-[11px] text-red-400 truncate" title={transError}>
            error: {transError.slice(0, 80)}
          </div>
        ) : null}
      </td>
      <td className="py-2 px-1 w-[88px] min-w-[88px] max-w-[88px] whitespace-nowrap">
        <div className="flex justify-center items-center gap-1 flex-nowrap">
          <button
            aria-label={`Play audio for ${spell.name}`}
            className="inline-flex h-8 w-8 min-w-[32px] shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-zinc-700"
            disabled={!effectiveNative}
            onClick={handlePlay}
            type="button"
            title={effectiveNative ? `speak in ${targetLang}` : "no translation yet"}
          >
            🔊
          </button>
          <button
            aria-label={`Chant help for ${spell.name}`}
            className="inline-flex h-8 w-8 min-w-[32px] shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-sm hover:bg-zinc-700"
            onClick={handleIdiom}
            type="button"
            title={`Help for ${spell.name} in ${getLangName(targetLang)}`}
          >
            💬
          </button>
        </div>
      </td>
    </tr>
  );
}
