"use client";

import { useSpellRow } from "@/hooks/useSpellRow";
import { MAX_TRANS_ERROR_LEN_MOBILE } from "@/lib/constants";

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
  const {
    input,
    boxText,
    effectiveNative,
    isTranslating,
    transError,
    langName,
    handleInputChange,
    handleBoxChange,
    handleTranslate,
    handlePlay,
    handleIdiom,
  } = useSpellRow(props);

  const { spell } = props;

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
          className="w-full rounded-xl border px-3 py-3 text-[15px] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field"
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
          Translation error: {transError.slice(0, MAX_TRANS_ERROR_LEN_MOBILE)} – check key / try again
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest font-semibold text-dim">Translation</span>
        <input
          aria-label={`Translation for ${spell.name} mobile`}
          className="w-full rounded-xl border px-3 text-[15px] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field"
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
