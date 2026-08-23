"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PrivacyDialog({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="border rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary">Privacy Policy</h3>
          <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-md bg-surface bg-surface-hover text-dim">✕</button>
        </div>
        <div className="space-y-3 text-[13px] leading-relaxed text-primary">
          <p>Everything you type and your characters are stored locally in your browser. We do not have accounts or servers storing your personal stuff, unless you enable cloud backups.</p>
          <p>Cloud Backup is optional and encrypted. Nobody can read it without your PIN.</p>
        </div>
        <div className="flex justify-end mt-5"><button onClick={onClose} className="rounded-lg text-xs h-8 px-4 font-semibold btn-accent">Done</button></div>
      </div>
    </div>
  );
}
