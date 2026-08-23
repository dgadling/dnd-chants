"use client";
type Props = { open: boolean; onClose: () => void; onAddCharacter: () => void };
export function WelcomeDialog({ open, onClose, onAddCharacter }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="border rounded-xl p-6 max-w-md w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
        <div className="h-8 w-8 rounded-lg grid place-items-center font-bold text-[14px] mb-3 bg-accent">🐉</div>
        <h3 className="text-[16px] font-semibold mb-2 text-primary">Your chants live here</h3>
        <p className="text-[13px] leading-relaxed mb-5 text-dim">Everything lives in this browser. No account needed. Cloud backup is optional and encrypted with a PIN only you know.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onAddCharacter} className="flex-1 rounded-lg text-[13px] h-10 px-4 font-semibold btn-accent">Add my character</button>
          <button onClick={onClose} className="flex-1 sm:flex-none rounded-lg text-[13px] h-10 px-4 bg-surface bg-surface-hover text-dim">Got it</button>
        </div>
      </div>
    </div>
  );
}
