"use client";

type Props = {
  spellName: string;
  school: string;
  englishPhrase: string;
  box: string;
  targetLang: string;
  status: string;
  saving: boolean;
  justSaved?: boolean;
  saveFailed?: boolean;
  onEnglishChange: (v: string) => void;
  onBoxChange: (v: string) => void;
  onTranslate: () => void;
  onTrySave: () => void;
  onAudio: () => void;
  onIdiom: () => void;
};

export function MobileCard(props: Props) {
  const saveTitle = props.justSaved
    ? "✓ saved locally 2s"
    : props.saveFailed
    ? "failed 3s – local only"
    : "Save locally (browser only)";
  return (
    <div className="card px-4 py-4 flex flex-col gap-3 rounded-xl border">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-[15px] truncate pr-2">{props.spellName}</div>
        <div className="text-[11px] text-[var(--dim)] whitespace-nowrap">{props.school} · {props.targetLang}</div>
      </div>

      <input
        aria-label={`Try phrasing for ${props.spellName}`}
        className="input text-[14px] h-11"
        value={props.englishPhrase}
        onChange={(e) => props.onEnglishChange(e.target.value)}
        placeholder={`try phrasing for ${props.spellName}`}
        onKeyDown={(e) => { if (e.key === "Enter" && props.englishPhrase.trim()) props.onTranslate(); }}
      />

      <input
        aria-label={`Chant box for ${props.spellName}`}
        className="input text-[14px] h-11 font-mono"
        value={props.box}
        onChange={(e) => props.onBoxChange(e.target.value)}
        placeholder="native [roman]"
      />

      <div className="flex gap-2">
        <button onClick={props.onTranslate} aria-label={`Translate ${props.spellName}`} className="btn flex-1 h-11 min-h-[44px] text-sm">Translate</button>
        <button onClick={props.onAudio} aria-label={`Play audio for ${props.spellName} – cached`} className="btn h-11 min-h-[44px] min-w-[44px] w-11 flex items-center justify-center">🔊</button>
        <button onClick={props.onIdiom} aria-label={`Search idiom for ${props.spellName}`} className="btn btn-ghost h-11 min-h-[44px] min-w-[44px] w-11 flex items-center justify-center">💬</button>
      </div>

      <div className="flex gap-2">
        <button onClick={props.onTrySave} disabled={props.saving} aria-label={`Save ${props.spellName} locally`} title={saveTitle} className={`btn flex-1 h-11 min-h-[44px] text-sm ${props.justSaved ? "bg-emerald-600" : props.saveFailed ? "bg-red-700" : ""}`}>{props.saving ? "Saving locally..." : props.justSaved ? "✓ Saved locally" : props.saveFailed ? "Failed" : "Save locally"}</button>
      </div>

      {props.status ? <div className={`text-[11px] ${props.justSaved ? "text-emerald-300" : props.saveFailed ? "text-red-300" : "text-amber-200"}`}>{props.status} {props.justSaved ? "(local only)" : ""}</div> : null}
    </div>
  );
}
