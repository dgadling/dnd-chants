"use client";

type Props = {
  spellName: string;
  box: string;
  targetLang: string;
  status: string;
  onBoxChange: (v: string) => void;
  onTranslate: () => void;
  onTrySave: () => void;
  onAudio: () => void;
  onIdiom: () => void;
};

export function DesktopRow(props: Props) {
  return (
    <div className="grid grid-cols-[200px_1fr_140px] gap-3 items-start card px-3 py-3 rounded-lg">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="text-[15px] font-semibold truncate leading-tight" title={props.spellName}>
          {props.spellName}
        </div>
        <div className="text-[11px] text-[var(--dim)]">{props.targetLang}</div>
        {props.status ? <div className="text-[11px] text-amber-200">{props.status}</div> : null}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <input className="input text-[14px] w-full h-9" value={props.box} onChange={(e) => props.onBoxChange(e.target.value)} placeholder="native [roman]" />
      </div>

      <div className="flex gap-2 items-start flex-wrap">
        <button onClick={props.onTranslate} className="btn text-xs h-9 px-3">Translate</button>
        <button onClick={props.onAudio} aria-label={`Play audio for ${props.spellName}`} className="btn text-xs w-9 h-9 p-0 flex items-center justify-center" title="play audio">🔊</button>
        <button onClick={props.onTrySave} className="btn text-xs h-9 px-3">Save</button>
        <button onClick={props.onIdiom} aria-label={`Search idiom for ${props.spellName}`} className="btn btn-ghost text-xs w-9 h-9 p-0 flex items-center justify-center" title="idiom">💬</button>
      </div>
    </div>
  );
}
