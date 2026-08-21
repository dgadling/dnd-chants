"use client";

import { LANG_OPTIONS, getLangOptionDisplay } from "@/lib/lang";

type Props = {
  spellName: string;
  school: string;
  box: string;
  targetLang: string;
  status: string;
  saving: boolean;
  onBoxChange: (v: string) => void;
  onLangChange: (v: string) => void;
  onTranslate: () => void;
  onTrySave: () => void;
  onAudio: () => void;
  onIdiom: () => void;
};

export function MobileCard(props: Props) {
  return (
    <div className="card px-3 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-semibold text-sm truncate">{props.spellName}</div>
        </div>
        <div className="text-[11px] text-[var(--dim)]">{props.school}</div>
      </div>

      <input className="input text-sm" value={props.box} onChange={(e) => props.onBoxChange(e.target.value)} placeholder="native [roman]" />

      <div className="flex gap-2 items-center">
        <select className="input text-sm flex-1" value={props.targetLang} onChange={(e) => props.onLangChange(e.target.value)}>
          {LANG_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>{getLangOptionDisplay(o)}</option>
          ))}
        </select>
        <button onClick={props.onTranslate} className="btn text-sm h-11 min-h-[44px] min-w-[44px] px-4">Trans</button>
      </div>

      <div className="flex gap-2">
        <button onClick={props.onAudio} className="btn h-11 min-h-[44px] min-w-[44px] w-11 flex items-center justify-center">🔊</button>
        <button onClick={props.onTrySave} disabled={props.saving} className="btn flex-1 h-11 min-h-[44px] text-sm">{props.saving ? "Save..." : "Save"}</button>
        <button onClick={props.onIdiom} className="btn btn-ghost h-11 min-h-[44px] min-w-[44px] w-11 flex items-center justify-center">💬</button>
      </div>

      {props.status ? <div className="text-[11px] text-amber-200">{props.status}</div> : null}
    </div>
  );
}
