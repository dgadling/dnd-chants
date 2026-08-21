"use client";

type Props = {
  spellName: string;
  englishPhrase: string;
  box: string;
  targetLang: string;
  status: string;
  onEnglishChange: (v: string) => void;
  onBoxChange: (v: string) => void;
  onTranslate: () => void;
  onTrySave: () => void;
  onAudio: () => void;
  onIdiom: () => void;
};

export function DesktopRow(props: Props) {
  return (
    <div className="grid grid-cols-[180px_1fr_1fr_140px] gap-3 items-start card px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors">
      <div className="flex flex-col gap-1.5 min-w-0 pt-1">
        <div className="text-[14px] font-semibold leading-tight truncate" title={props.spellName}>
          {props.spellName}
        </div>
        <div className="text-[11px] text-[var(--dim)]">{props.targetLang}</div>
        {props.status ? <div className="text-[11px] text-amber-300 font-medium">{props.status}</div> : null}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <input
          className="input text-[13px] w-full h-9"
          value={props.englishPhrase}
          onChange={(e) => props.onEnglishChange(e.target.value)}
          placeholder={`try phrasing for ${props.spellName}`}
          onKeyDown={(e) => { if (e.key === "Enter" && props.englishPhrase.trim()) props.onTranslate(); }}
        />
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <input
          className="input text-[13px] w-full h-9 font-mono"
          value={props.box}
          onChange={(e) => props.onBoxChange(e.target.value)}
          placeholder="native [roman]"
        />
      </div>

      <div className="flex gap-1.5 items-start flex-wrap">
        <button onClick={props.onTranslate} className="btn text-xs h-9 px-3" title="Translate try phrasing">Trans</button>
        <button onClick={props.onAudio} aria-label={`Play audio for ${props.spellName}`} className="btn text-xs w-9 h-9 p-0 flex items-center justify-center" title="play audio">🔊</button>
        <button onClick={props.onTrySave} className="btn text-xs h-9 px-3">Save</button>
        <button onClick={props.onIdiom} aria-label={`Search idiom for ${props.spellName}`} className="btn btn-ghost text-xs w-9 h-9 p-0 flex items-center justify-center" title="idiom search">💬</button>
      </div>
    </div>
  );
}
