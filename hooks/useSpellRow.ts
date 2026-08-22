"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBox, parseBox, getLangName } from "@/lib/lang";
import { playCachedAudio } from "@/lib/audio";
import { translateClient } from "@/lib/translate-client";

type Spell = { name: string; school: string };

type Args = {
  spell: Spell;
  targetLang: string;
  school: string;
  initialInput: string;
  initialNative: string;
  initialRoman: string;
  onSave?: (englishPhrase: string, native: string, roman: string) => void;
  helpTemplate?: string;
};

const DEFAULT_TMPL =
  "Help me come up with a short chant or idiom for the Dungeons & Dragons spell {spell} in {language} that would sound reasonable to a native speaker.";

export function useSpellRow({
  spell,
  targetLang,
  school,
  initialInput,
  initialNative,
  initialRoman,
  onSave,
  helpTemplate,
}: Args) {
  const [input, setInput] = useState(initialInput || "");
  const [boxText, setBoxText] = useState(() => formatBox(initialNative, initialRoman));
  const [isTranslating, setIsTranslating] = useState(false);
  const [transError, setTransError] = useState("");
  const lastTranslatedRef = useRef("");

  useEffect(() => {
    if (initialInput) {
      setInput((prev) => (prev !== initialInput ? initialInput : prev));
    }
  }, [initialInput]);

  useEffect(() => {
    if (initialNative) {
      setBoxText((prev) => (!prev.trim() ? formatBox(initialNative, initialRoman) : prev));
    }
  }, [initialNative, initialRoman]);

  const parsed = parseBox(boxText);
  const effectiveNative = parsed.native;
  const effectiveRoman = parsed.roman;
  const langName = getLangName(targetLang);

  const autosave = useCallback(
    (enPhrase: string, nat: string, rom: string) => {
      if (!onSave) return;
      const ep = enPhrase.trim().slice(0, 500);
      const n = nat.slice(0, 1000);
      const r = rom.slice(0, 1000);
      if (!ep && !n) return;
      onSave(ep, n, r);
    },
    [onSave]
  );

  const handleInputChange = useCallback(
    (v: string) => {
      setInput(v);
      autosave(v, effectiveNative, effectiveRoman);
    },
    [autosave, effectiveNative, effectiveRoman]
  );

  const handleBoxChange = useCallback(
    (v: string) => {
      setBoxText(v);
      const p = parseBox(v);
      autosave(input, p.native, p.roman);
    },
    [autosave, input]
  );

  const handleTranslate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (norm === lastTranslatedRef.current) return;
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTransError(msg.slice(0, 80));
    } finally {
      setIsTranslating(false);
    }
  }, [input, targetLang, autosave]);

  const handlePlay = useCallback(() => {
    if (!effectiveNative) return;
    void playCachedAudio(effectiveNative, targetLang);
  }, [effectiveNative, targetLang]);

  const handleIdiom = useCallback(() => {
    const raw = helpTemplate && helpTemplate.trim() ? helpTemplate : DEFAULT_TMPL;
    const hasPlace = raw.includes("{spell}") || raw.includes("{language}") || raw.includes("{school}");
    const q = hasPlace
      ? raw.replaceAll("{spell}", spell.name).replaceAll("{language}", langName).replaceAll("{school}", school)
      : raw;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "popup,width=900,height=700");
  }, [helpTemplate, langName, school, spell.name]);

  return {
    input,
    boxText,
    effectiveNative,
    effectiveRoman,
    isTranslating,
    transError,
    langName,
    handleInputChange,
    handleBoxChange,
    handleTranslate,
    handlePlay,
    handleIdiom,
  };
}
