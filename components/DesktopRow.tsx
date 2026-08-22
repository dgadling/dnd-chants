"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBox, parseBox } from "@/lib/lang";
import { playCachedAudio } from "@/lib/audio";

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
  const [justSaved, setJustSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [transError, setTransError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
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

  const handleTranslate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (norm === lastTranslatedRef.current && effectiveNative) return;
    if (norm === lastTranslatedRef.current && isTranslating) return;
    setIsTranslating(true);
    setTransError("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, source: "en", target: targetLang }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const newNative = (j.translated as string || "").slice(0, 500);
      const newRoman = (j.romanized as string || "").slice(0, 500);
      const formatted = formatBox(newNative, newRoman);
      setBoxText(formatted);
      lastTranslatedRef.current = norm;
    } catch (e: any) {
      setTransError(String(e?.message || e).slice(0, 80));
    } finally {
      setIsTranslating(false);
    }
  }, [input, targetLang, effectiveNative, isTranslating]);

  const handlePlay = useCallback(() => {
    const toSpeak = effectiveNative;
    if (!toSpeak) return;
    void playCachedAudio(toSpeak, targetLang);
  }, [effectiveNative, targetLang]);

  const handleSave = useCallback(() => {
    if (!effectiveNative || !input.trim()) return;
    setSaveFailed(false);
    setIsSaving(true);
    try {
      if (onSave) {
        onSave(input.trim(), effectiveNative.slice(0, 1000), (effectiveRoman || "").slice(0, 1000));
      }
      setJustSaved(true);
      setSaveFailed(false);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setSaveFailed(true);
      setTimeout(() => setSaveFailed(false), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [effectiveNative, effectiveRoman, input, onSave]);

  const saveDisabled = !effectiveNative || !input.trim() || isSaving;
  const saveTitle = justSaved
    ? "✓ saved locally 2s"
    : saveFailed
    ? "failed 3s – local only, not server"
    : !effectiveNative
    ? "Translate first – save is local-only"
    : isSaving
    ? "Saving locally..."
    : "Save locally (browser only, not server)";

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
          onChange={(e) => setInput(e.target.value)}
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
          onChange={(e) => setBoxText(e.target.value)}
          placeholder="native [roman]"
        />
        {transError ? (
          <div className="mt-1 text-[11px] text-red-400 truncate" title={transError}>
            error: {transError.slice(0, 80)}
          </div>
        ) : null}
      </td>
      <td className="py-2 px-1 w-[96px] min-w-[96px] max-w-[96px] whitespace-nowrap">
        <div className="flex items-center gap-1 flex-nowrap">
          <button
            aria-label={`Play audio for ${spell.name}`}
            className="inline-flex h-7 w-7 min-w-[28px] shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-zinc-700"
            disabled={!effectiveNative}
            onClick={handlePlay}
            type="button"
            title={effectiveNative ? `speak in ${targetLang}` : "no translation yet"}
          >
            🔊
          </button>
          <button
            aria-label={`Save ${spell.name}`}
            className={`inline-flex h-7 w-[56px] min-w-[56px] max-w-[56px] shrink-0 items-center justify-center rounded-md border text-[11px] font-medium disabled:opacity-60 disabled:cursor-not-allowed px-0 ${
              saveFailed
                ? "border-red-400 bg-red-900/30 text-red-300"
                : justSaved
                ? "border-emerald-400 bg-emerald-900/30 text-emerald-300"
                : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
            }`}
            disabled={saveDisabled}
            onClick={handleSave}
            type="button"
            title={saveTitle}
          >
            {isSaving ? "…" : saveFailed ? "✕" : justSaved ? "✓" : "💾"}
          </button>
        </div>
      </td>
    </tr>
  );
}
