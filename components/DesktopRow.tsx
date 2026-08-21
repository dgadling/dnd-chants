"use client";

type Props = {
  spellName: string;
  box: string;
  targetLang: string;
  status: string;
  onBoxChange: (v: string) => void;
  onLangChange: (v: string) => void;
  onTranslate: () => void;
  onTrySave: () => void;
  onAudio: () => void;
  onIdiom: () => void;
};

import { LANG_OPTIONS, getLangOptionDisplay } from "@/lib/lang";

export function DesktopRow(props: Props) {
  return (
    <div className="grid grid-cols-[160px_1fr_260px_92px] gap-2 items-start card px-2 py-2">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <div className="text-sm font-semibold truncate" title={props.spellName}>
            {props.spellName}
          </div>
        </div>
        {props.status ? <div className="text-[11px] text-amber-200">{props.status}</div> : null}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <input className="input text-sm w-full" value={props.box} onChange={(e) => props.onBoxChange(e.target.value)} placeholder="native [roman]" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <select className="input text-xs flex-1 min-w-0" value={props.targetLang} onChange={(e) => props.onLangChange(e.target.value)}>
            {LANG_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{getLangOptionDisplay(o)}</option>
            ))}
          </select>
          <button onClick={props.onTranslate} className="btn text-xs w-[96px] min-w-[96px] max-w-[96px]">Trans</button>
        </div>
      </div>

      <div className="flex gap-1 flex-col min-w-[92px]">
        <div className="flex gap-1">
          <button onClick={props.onAudio} className="btn text-xs w-[28px] min-w-[28px] max-w-[28px] h-8 p-0 flex items-center justify-center" title="play audio">🔊</button>
          <button onClick={props.onTrySave} className="btn text-xs w-[56px] min-w-[56px] max-w-[56px] h-8">Save</button>
        </div>
        <div className="flex gap-1">
          <button onClick={props.onIdiom} className="btn btn-ghost text-xs w-[28px] min-w-[28px] max-w-[28px] h-8 p-0 flex items-center justify-center" title="idiom">💬</button>
        </div>
      </div>
    </div>
  );
}
