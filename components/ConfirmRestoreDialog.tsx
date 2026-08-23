"use client";
type Props = { open: boolean; onNo: () => void; onYes: () => void };
export function ConfirmRestoreDialog({ open, onNo, onYes }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onNo}>
      <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-2 text-primary">Found existing backup</h3>
        <p className="text-[13px] text-dim mb-4">Found existing cloud backup. Restore it to this device? This will replace local data.</p>
        <div className="flex justify-between gap-2"><button onClick={onNo} className="rounded-lg text-xs h-9 px-4 bg-surface border border-default text-primary bg-surface-hover">No, keep local</button><button onClick={onYes} className="rounded-lg text-xs h-9 px-4 font-semibold btn-accent">Yes, restore</button></div>
      </div>
    </div>
  );
}
