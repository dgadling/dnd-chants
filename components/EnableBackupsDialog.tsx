"use client";
import { useState } from "react";
type Props = { open: boolean; onClose: () => void; onEnable: (pin: string) => void; isEnabling: boolean; discordClientId: string; };
export function EnableBackupsDialog({ open, onClose, onEnable, isEnabling, discordClientId }: Props) {
  const [pin, setPin] = useState(""); const [confirmPin, setConfirmPin] = useState(""); const [showPin, setShowPin] = useState(false);
  const isValidPin = /^\d{6}$/.test(pin); const isMatching = pin === confirmPin && isValidPin; const canEnable = isMatching && !!discordClientId && !isEnabling;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-zinc-100">Enable cloud backup</h3><button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300">✕</button></div>
        <div className="space-y-3 text-[13px] leading-relaxed text-zinc-300">
          <p>Everything is stored locally on this machine, in this browser right now. Cloud backup is optional.</p>
          <p>When you enable backups, we encrypt your characters and chants on this device with the 6-digit PIN you choose below. We only store encrypted info. Nobody but you  can see your data without A LOT of effort. It is not perfect security, but it is private.</p>
          <p className="text-[12px] text-amber-200/90">If you forget the PIN below, and lose access to your logged in devices, you lose your backup. There is no recovery without the PIN.</p>
          <p>We only use Discord for identity, so only you can fetch your encrypted encrypted information. We don't get anything else from Discord.</p>
        </div>
        <div className="mt-4 space-y-3">
          <div><label className="text-[11px] uppercase tracking-wide font-semibold text-zinc-400">6-digit PIN</label><div className="mt-1 flex gap-2"><input type={showPin ? "text" : "password"} inputMode="numeric" pattern="\d*" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="flex-1 h-10 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 text-sm tracking-widest placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400" /><button type="button" onClick={() => setShowPin(v => !v)} className="h-10 px-3 rounded-lg bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600">{showPin ? "Hide" : "Show"}</button></div>{pin && !isValidPin ? <div className="text-[11px] text-amber-300 mt-1">PIN must be exactly 6 digits</div> : null}</div>
          <div><label className="text-[11px] uppercase tracking-wide font-semibold text-zinc-400">Confirm PIN</label><input type={showPin ? "text" : "password"} inputMode="numeric" pattern="\d*" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="mt-1 w-full h-10 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 text-sm tracking-widest placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400" />{confirmPin && pin !== confirmPin ? <div className="text-[11px] text-red-300 mt-1">PINs do not match</div> : null}</div>
          {!discordClientId ? (<div className="text-[12px] text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg p-2">Discord client ID not configured. Set NEXT_PUBLIC_DISCORD_CLIENT_ID.</div>) : null}
        </div>
        <div className="flex justify-between gap-2 mt-5"><button onClick={onClose} className="bg-zinc-700 text-zinc-200 rounded-lg text-xs h-9 px-4 hover:bg-zinc-600">Cancel</button><button onClick={() => onEnable(pin)} disabled={!canEnable} className="bg-amber-400 text-black rounded-lg text-xs h-9 px-4 hover:bg-amber-300 font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"><span>🔗</span><span>{isEnabling ? "Connecting…" : "Login with Discord & enable"}</span></button></div>
      </div>
    </div>
  );
}
