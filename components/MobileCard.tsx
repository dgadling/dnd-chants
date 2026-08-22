"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBox, parseBox, getLangName } from "@/lib/lang";
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

export function MobileCard(props: Props) {
  const { spell, targetLang, school, initialInput, initialNative, initialRoman, onSave } = props;
  const [input, setInput] = useState(initialInput || "");
  const [boxText, setBoxText] = useState(() => formatBox(initialNative, initialRoman));
  const [justSaved, setJustSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [transError, setTransError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
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

  const handleTranslate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const norm = trimmed.toLowerCase();
    if (norm === lastTranslatedRef.current && effectiveNative) return;
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
  }, [input, targetLang, effectiveNative]);

  const handlePlay = useCallback(() => {
    const toSpeak = effectiveNative;
    if (!toSpeak) return;
    void playCachedAudio(toSpeak, targetLang);
  }, [effectiveNative, targetLang]);

  const handleIdiom = useCallback(() => {
    const englishTry = input.trim() || spell.name;
    const langName = getLangName(targetLang);
    const q = `idiom in ${langName} for "${englishTry}"`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "popup,width=900,height=700");
  }, [input, spell.name, targetLang]);

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

  const langName = getLangName(targetLang);

  const saveDisabled = !effectiveNative || !input.trim() || isSaving;
  const saveTitle = justSaved
    ? "✓ saved locally 2s"
    : saveFailed
    ? "failed 3s – local only"
    : !effectiveNative
    ? "Translate first"
    : isSaving
    ? "Saving locally..."
    : "Save locally (browser only)";

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-800 border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100 truncate">
            {spell.name}
          </h3>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest font-semibold text-zinc-400">Try wording</span>
        <input
          aria-label={`Try phrasing for ${spell.name} mobile`}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-black text-[15px] font-semibold h-11 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:active:scale-100"
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
        <span className="text-[11px] uppercase tracking-widest font-semibold text-zinc-400">Translation</span>
        <input
          aria-label={`Translation for ${spell.name} mobile`}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          style={{ height: "44px" }}
          value={boxText}
          onChange={(e) => setBoxText(e.target.value)}
          placeholder="native [roman]"
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <button
          aria-label={`Idiom search for ${spell.name} mobile`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 text-[14px] font-medium disabled:opacity-60 active:bg-zinc-700"
          disabled={!input.trim()}
          onClick={handleIdiom}
          type="button"
          title={`Search idiom in ${langName}`}
        >
          <span>💬</span>
          <span className="hidden sm:inline">Idiom</span>
        </button>
        <button
          aria-label={`Play audio for ${spell.name} mobile`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 text-[14px] font-medium disabled:opacity-60 active:bg-zinc-700"
          disabled={!effectiveNative}
          onClick={handlePlay}
          type="button"
        >
          <span>🔊</span>
          <span>Listen</span>
        </button>
        <button
          aria-label={`Save ${spell.name} mobile`}
          className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border text-[14px] font-semibold active:scale-[0.98] transition-all disabled:opacity-60 ${
            saveFailed
              ? "border-red-400 bg-red-900/30 text-red-300"
              : justSaved
              ? "border-emerald-400 bg-emerald-900/30 text-emerald-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-100"
          }`}
          disabled={saveDisabled}
          onClick={handleSave}
          type="button"
          title={saveTitle}
        >
          <span>{isSaving ? "…" : saveFailed ? "failed" : justSaved ? "✓ Saved" : "💾 Save"}</span>
        </button>
      </div>
    </div>
  );
}
