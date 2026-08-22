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
  helpTemplate?: string;
};

export function MobileCard(props: Props) {
  const { spell, targetLang, school, initialInput, initialNative, initialRoman, onSave, helpTemplate } = props;
  const [input, setInput] = useState(initialInput || "");
  const [boxText, setBoxText] = useState(() => formatBox(initialNative, initialRoman));
  const [isTranslating, setIsTranslating] = useState(false);
  const [transError, setTransError] = useState<string>("");
  const lastTranslatedRef = useRef<string>("");

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
  }, [input, targetLang, effectiveNative, autosave]);

  const handlePlay = useCallback(() => {
    const toSpeak = effectiveNative;
    if (!toSpeak) return;
    void playCachedAudio(toSpeak, targetLang);
  }, [effectiveNative, targetLang]);

  const DEFAULT_TMPL = "Help me come up with a short chant or idiom for the Dungeons & Dragons spell {spell} in {language} that would sound reasonable to a native speaker.";
  const handleIdiom = () => {
    const langName = getLangName(targetLang);
    const raw = helpTemplate && helpTemplate.trim() ? helpTemplate : DEFAULT_TMPL;
    const hasPlace = raw.includes("{spell}") || raw.includes("{language}") || raw.includes("{school}");
    const q = hasPlace
      ? raw.replaceAll("{spell}", spell.name).replaceAll("{language}", langName).replaceAll("{school}", school)
      : raw;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "popup,width=900,height=700");
  };

  const langName = getLangName(targetLang);

  return (
    <div className="flex flex-col gap-3 p-3 border bg-surface border-default">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight truncate text-primary">
            {spell.name}
          </h3>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest font-semibold text-dim">Try wording</span>
        <input
          aria-label={`Try phrasing for ${spell.name} mobile`}
          className="w-full rounded-xl border px-3 py-3 text-[15px] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus-ring-accent input-field"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="e.g. spying eye"
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              handleTranslate();
            }
          }}
        />
      </label>

      <button
        aria-label={`Translate ${spell.name} mobile`}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold h-11 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:active:scale-100 btn-accent"
        disabled={!input.trim() || isTranslating}
        onClick={handleTranslate}
        type="button"
      >
        <span className="text-base">▶</span>
        <span>{isTranslating ? "Translating…" : `In ${langName}`}</span>
      </button>
      {transError && (
        <div className="text-xs text-red-400 px-1" title={transError}>
          Translation error: {transError.slice(0, 120)} – check key / try again
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest font-semibold text-dim">Translation</span>
        <input
          aria-label={`Translation for ${spell.name} mobile`}
          className="w-full rounded-xl border px-3 text-[15px] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus-ring-accent input-field"
          style={{ height: "44px" }}
          value={boxText}
          onChange={(e) => handleBoxChange(e.target.value)}
          placeholder="native [roman]"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          aria-label={`Play audio for ${spell.name} mobile`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium disabled:opacity-60 bg-surface border-default text-primary bg-surface-hover"
          disabled={!effectiveNative}
          onClick={handlePlay}
          type="button"
        >
          <span>🔊</span>
          <span>Listen</span>
        </button>
        <button
          aria-label={`Chant help for ${spell.name} mobile`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium bg-surface border-default text-primary bg-surface-hover"
          onClick={handleIdiom}
          type="button"
          title={`Brainstorm with Google for ${spell.name} in ${langName}`}
        >
          <span>💬</span>
          <span>Idiom</span>
        </button>
      </div>
    </div>
  );
}
