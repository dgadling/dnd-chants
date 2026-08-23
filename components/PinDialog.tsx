"use client";
type Props = { open: boolean; mode: string; onCancel: () => void; onConfirm: (pin: string) => void };
export function PinDialog({ open, mode, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-2 text-primary">{mode==="backup"?"Enter PIN for backup":"Enter PIN to decrypt"}</h3>
        <input id="pin-dialog-input" type="password" inputMode="numeric" maxLength={6} placeholder="123456" className="w-full h-10 rounded-lg border px-3 text-sm tracking-widest focus:outline-none focus:ring-2 focus-ring-accent input-field" onKeyDown={e=>{ if(e.key==="Enter"){ const el=document.getElementById("pin-dialog-input") as HTMLInputElement; const v=el?.value||""; if(/^\d{6}$/.test(v)) onConfirm(v); } if(e.key==="Escape") onCancel(); }} />
        <div className="flex justify-between gap-2 mt-4"><button onClick={onCancel} className="rounded-lg text-xs h-8 px-4 bg-surface bg-surface-hover text-dim">Cancel</button><button onClick={()=>{ const el=document.getElementById("pin-dialog-input") as HTMLInputElement; const v=el?.value||""; if(/^\d{6}$/.test(v)) onConfirm(v); }} className="rounded-lg text-xs h-8 px-4 font-semibold btn-accent">Confirm</button></div>
      </div>
    </div>
  );
}
