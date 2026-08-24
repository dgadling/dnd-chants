"use client";

import { useSpellRow } from "@/hooks/useSpellRow";
import { TRANS_ERROR_MAX_LEN } from "@/lib/constants";

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

export function DesktopRow(props: Props) {
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
    <tr className="border-b border-default">
      <td className="py-2 px-2 text-sm font-medium whitespace-nowrap max-w-[9rem] truncate align-middle text-primary">
        {spell.name}
      </td>
      <td className="py-2 px-2 min-w-[11rem] align-middle">
        <input
          aria-label={`Try phrasing for ${spell.name}`}
          className="w-full h-8 rounded-md border px-2 text-sm focus:outline-none focus:ring-1 focus-ring-accent input-field"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="try phrasing"
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) handleTranslate();
          }}
        />
      </td>
      <td className="py-2 px-1 align-middle text-center">
        <button
          aria-label={`Translate ${spell.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed align-middle btn-accent"
          disabled={!input.trim() || isTranslating}
          onClick={handleTranslate}
          type="button"
          title={transError || "Translate"}
        >
          {isTranslating ? "…" : "▶"}
        </button>
      </td>
      <td className="py-2 px-2 text-sm max-w-[16rem] min-w-[10rem] align-middle text-primary">
        <input
          aria-label={`Translation for ${spell.name}`}
          className="w-full h-8 rounded-md border px-2 text-[13px] focus:outline-none focus:ring-1 focus-ring-accent placeholder:text-[var(--text-dim)] input-field"
          value={boxText}
          onChange={(e) => handleBoxChange(e.target.value)}
          placeholder="native [roman]"
        />
        {transError ? (
          <div className="mt-1 text-[11px] text-red-400 truncate" title={transError}>
            error: {transError.slice(0, TRANS_ERROR_MAX_LEN)}
          </div>
        ) : null}
      </td>
      <td className="py-2 px-1 w-[88px] min-w-[88px] max-w-[88px] whitespace-nowrap align-middle">
        <div className="flex justify-center items-center gap-1 flex-nowrap align-middle">
          <button
            aria-label={`Play audio for ${spell.name}`}
            className="inline-flex h-8 w-8 min-w-[32px] shrink-0 items-center justify-center rounded-md border text-sm disabled:opacity-60 disabled:cursor-not-allowed align-middle bg-surface border-default text-primary bg-surface-hover"
            disabled={!effectiveNative}
            onClick={handlePlay}
            type="button"
            title={effectiveNative ? `speak in ${props.targetLang}` : "no translation yet"}
          >
            🔊
          </button>
          <button
            aria-label={`Chant help for ${spell.name}`}
            className="inline-flex h-8 w-8 min-w-[32px] shrink-0 items-center justify-center rounded-md border text-sm align-middle bg-surface border-default text-primary bg-surface-hover"
            onClick={handleIdiom}
            type="button"
            title={`Brainstorm with Google for ${spell.name} in ${langName}`}
          >
            💬
          </button>
        </div>
      </td>
    </tr>
  );
}
