"use client";

type Props = {
  spellName: string;
  englishPhrase: string;
  box: string;
  targetLang: string;
  status: string;
  justSaved?: boolean;
  saveFailed?: boolean;
  saving?: boolean;
  onEnglishChange: (v: string) => void;
  onBoxChange: (v: string) => void;
  onTranslate: () => void;
  onTrySave: () => void;
  onAudio: () => void;
  onIdiom: () => void;
};

export function DesktopRow(props: Props) {
  const saveTitle = props.justSaved
    ? "✓ saved locally 2s"
    : props.saveFailed
    ? "failed 3s – local only, not server"
    : !props.box.trim()
    ? "Translate first – save is local-only"
    : props.saving
    ? "Saving locally..."
    : "Save locally (browser only, not server)";
  const saveLabel = props.justSaved ? "✓ Saved" : props.saveFailed ? "Failed" : props.saving ? "Saving..." : "Save";
  return (
    <div className="grid grid-cols-[180px_1fr_1fr_140px] gap-3 items-start card px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors">
      <div className="flex flex-col gap-1.5 min-w-0 pt-1">
        <div className="text-[14px] font-semibold leading-tight truncate" title={props.spellName}>
          {props.spellName}
        </div>
        <div className="text-[11px] text-[var(--dim)]">{props.targetLang}</div>
        {props.status ? <div className={`text-[11px] font-medium ${props.justSaved ? "text-emerald-300" : props.saveFailed ? "text-red-300" : "text-amber-300"}`}>{props.status}</div> : null}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <input
          aria-label={`Try phrasing for ${props.spellName}`}
          className="input text-[13px] w-full h-9"
          value={props.englishPhrase}
          onChange={(e) => props.onEnglishChange(e.target.value)}
          placeholder={`try phrasing for ${props.spellName}`}
          onKeyDown={(e) => { if (e.key === "Enter" && props.englishPhrase.trim()) props.onTranslate(); }}
        />
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <input
          aria-label={`Chant box for ${props.spellName} – native [roman] editable`}
          className="input text-[13px] w-full h-9 font-mono"
          value={props.box}
          onChange={(e) => props.onBoxChange(e.target.value)}
          placeholder="native [roman]"
        />
      </div>

      <div className="flex gap-1.5 items-start flex-wrap">
        <button onClick={props.onTranslate} aria-label={`Translate ${props.spellName}`} className="btn text-xs h-9 px-3" title="Translate try phrasing">Trans</button>
        <button onClick={props.onAudio} aria-label={`Play audio for ${props.spellName}`} className="btn text-xs w-9 h-9 p-0 flex items-center justify-center" title="play audio – cached mem→IDB→server">🔊</button>
        <button onClick={props.onTrySave} aria-label={`Save ${props.spellName} locally`} className={`btn text-xs h-9 px-3 ${props.justSaved ? "bg-emerald-600" : props.saveFailed ? "bg-red-700" : ""}`} title={saveTitle}>{saveLabel}</button>
        <button onClick={props.onIdiom} aria-label={`Search idiom for ${props.spellName}`} className="btn btn-ghost text-xs w-9 h-9 p-0 flex items-center justify-center" title="idiom search – opens Google">💬</button>
      </div>
    </div>
  );
}
