"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  helpTemplate: string;
  setHelpTemplate: (s: string) => void;
  defaultTemplate: string;
};

export function HelpConfigDialog({ open, onClose, helpTemplate, setHelpTemplate, defaultTemplate }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="border rounded-xl p-5 max-w-md w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-2 text-primary">Configure help</h3>
        <textarea className="w-full min-h-[96px] rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus-ring-accent resize-y input-field" rows={4} value={helpTemplate} onChange={(e) => setHelpTemplate(e.target.value)} />
        <div className="flex justify-between gap-2 mt-4">
          <button onClick={() => setHelpTemplate(defaultTemplate)} className="rounded-lg text-xs h-8 px-4 bg-surface bg-surface-hover text-dim">Default</button>
          <button onClick={onClose} className="rounded-lg text-xs h-8 px-4 font-semibold btn-accent">Done</button>
        </div>
      </div>
    </div>
  );
}
