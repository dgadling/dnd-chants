"use client";

type Props = {
  open: boolean;
  linkInput: string;
  setLinkInput: (s: string) => void;
  linkStatus: string;
  isLinking: boolean;
  onLinkClick: () => void;
  onClose: () => void;
  charactersCount: number;
};

export function AddCharacterDialog({ open, linkInput, setLinkInput, linkStatus, isLinking, onLinkClick, onClose, charactersCount }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-3 text-primary">Add Character</h3>
        <input className="w-full h-10 rounded-lg border px-3 text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://www.dndbeyond.com/characters/12345678 or 12345678" onKeyDown={(e) => { if (e.key === "Enter") onLinkClick(); }} autoFocus />
        <div className="flex gap-2 mt-3">
          <button onClick={onLinkClick} disabled={isLinking} className="flex-1 rounded-lg text-sm h-10 font-semibold disabled:opacity-60 btn-accent">{isLinking ? "Linking…" : charactersCount ? "Add Character" : "Link Character"}</button>
          <button onClick={onClose} className="rounded-lg text-sm h-10 px-4 bg-surface bg-surface-hover text-dim">Cancel</button>
        </div>
        {linkStatus ? <div className="text-xs mt-2 text-accent-soft">{linkStatus}</div> : null}
      </div>
    </div>
  );
}
