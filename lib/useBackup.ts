"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken, signInWithDiscordCustomToken } from "@/lib/firebase-client";
import { deriveKeyFromPin, exportKeyToBase64, STORAGE_BACKUP_KEY } from "@/lib/backup-crypto";
import { isAllowedOrigin, STORAGE_BACKUP_ENABLED, STORAGE_LAST_BACKUP, STORAGE_LAST_BACKUP_SIZE, STORAGE_LAST_CLOUD_ACTION, formatBytes, formatLocalTimestamp, backupToCloud, restoreFromCloud } from "@/lib/backup";
import { useDiscordAuth } from "@/hooks/useDiscordAuth";
import { useBackupState } from "@/hooks/useBackupState";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useBackupAutoSync } from "@/hooks/useBackupAutoSync";
import { useBackupActions } from "@/hooks/useBackupActions";

type Opts = { characters: unknown[]; schoolLangsPerChar: Record<string, unknown>; extrasPerChar: Record<string, unknown>; activeId: string; helpTemplate: string };
type Dialog = { open: boolean; mode: "backup" | "restore" | "confirm-restore"; resolve?: (v: string | boolean | null) => void };
type BackupUi = {
  showEnableBackups: boolean;
  lastBackupISO: string | null;
  lastBackupSize: number | null;
  lastCloudAction: string | null;
  backupEnabled: boolean;
};

type DiscordUser = { id: string; username: string; avatar?: string | null };
type FirebaseUser = { uid: string; getIdTokenResult?: () => Promise<{ claims?: Record<string, unknown> }> };
type User = { firebase: FirebaseUser | null; discord: DiscordUser | null };

export function useBackup(opts: Opts) {
  const { user, setUser } = useDiscordAuth() as { user: User; setUser: (u: User) => void };
  const { ui, setUi } = useBackupState() as { ui: BackupUi; setUi: React.Dispatch<React.SetStateAction<BackupUi>> };
  const [busy, setBusy] = useState<{ status: string; isBusy: boolean }>({ status: "", isBusy: false });
  const [dlg, setDlg] = useState<Dialog>({ open: false, mode: "backup" });
  const refs = useRef<{ opts: Opts; pendingPin: string | null; discordState: string | null }>({ opts, pendingPin: null, discordState: null });

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenPayloadRef = useRef<string | null>(null);
  const lastBackedUpPayloadRef = useRef<string | null>(null);
  const isFirstAutoMountRef = useRef(true);

  useEffect(() => { refs.current.opts = opts; }, [opts]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (!isAllowedOrigin(e.origin)) return;
      const data = e.data as { type?: string; customToken?: string; discordUser?: { id: string; username: string; avatar?: string | null }; state?: string; error?: string } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "discord-auth-success" && data.customToken) {
        const exp = refs.current.discordState;
        if (!exp || !data.state || data.state !== exp) { setBusy({ status: "Discord state mismatch – try again", isBusy: false }); return; }
        try {
          setBusy({ status: "Signing in with Discord…", isBusy: true });
          const fb = await signInWithDiscordCustomToken(data.customToken) as FirebaseUser;
          const du = data.discordUser ? { id: data.discordUser.id, username: data.discordUser.username, avatar: data.discordUser.avatar } : null;
          setUser({ firebase: fb, discord: du });
          if (du) { try { localStorage.setItem(STORAGE_KEYS.DISCORD_USER, JSON.stringify(du)); } catch {} }
          try { localStorage.setItem(STORAGE_BACKUP_ENABLED, "1"); } catch {}
          setUi((p) => ({ ...p, backupEnabled: true }));
          const pending = refs.current.pendingPin;
          if (pending && /^\d{6}$/.test(pending)) {
            const uid = fb?.uid || `discord:${data.discordUser?.id || ""}`;
            const key = await deriveKeyFromPin(pending, uid);
            localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key));
            setUi((p) => ({ ...p, showEnableBackups: false }));
            try {
              const idTok = await getIdToken();
              if (idTok) {
                const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 5000);
                const chk = await fetch("/api/backup", { method: "GET", headers: { Authorization: `Bearer ${idTok}` }, signal: ac.signal as unknown as AbortSignal });
                clearTimeout(t);
                if (chk.status === 200) {
                  const doRestore = await new Promise<boolean>((res) => setDlg({ open: true, mode: "confirm-restore", resolve: (v) => res(!!v) }));
                  setDlg({ open: false, mode: "confirm-restore" });
                  if (doRestore) {
                    setBusy({ status: "Restoring existing backup…", isBusy: true });
                    try {
                      const restored = await restoreFromCloud(uid, pending);
                      const restoredData = restored.data as Record<string, unknown>;
                      if (Array.isArray((restoredData as any).characters)) localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify((restoredData as any).characters));
                      if ((restoredData as any).schoolLangsPerChar) localStorage.setItem(STORAGE_KEYS.SCHOOL_LANGS, JSON.stringify((restoredData as any).schoolLangsPerChar));
                      if ((restoredData as any).extrasPerChar) localStorage.setItem(STORAGE_KEYS.EXTRAS, JSON.stringify((restoredData as any).extrasPerChar));
                      if (typeof (restoredData as any).activeId === "string") localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, (restoredData as any).activeId);
                      if (typeof (restoredData as any).helpTemplate === "string") localStorage.setItem(STORAGE_KEYS.HELP_TEMPLATE, (restoredData as any).helpTemplate);
                      if ((restoredData as any).ddbLink) try { localStorage.setItem(STORAGE_KEYS.DDB_LINK, (restoredData as any).ddbLink); } catch {}
                      const now = new Date(); const msg = `Restored ${restored.size ? `${formatBytes(restored.size)} at ` : ""}${formatLocalTimestamp(now)}`;
                      setUi((p) => ({ ...p, lastCloudAction: msg, showEnableBackups: false }));
                      try { localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
                      setBusy({ status: "Restore complete – reloading", isBusy: false });
                      refs.current.pendingPin = null; refs.current.discordState = null;
                      setTimeout(() => window.location.reload(), 500); return;
                    } catch (re: unknown) {
                      const rm = re instanceof Error ? re.message : String(re);
                      setBusy({ status: rm.slice(0, 200), isBusy: false });
                      refs.current.pendingPin = null; refs.current.discordState = null;
                      setUi((p) => ({ ...p, showEnableBackups: false })); return;
                    }
                  } else {
                    setBusy({ status: "", isBusy: false });
                    setUi((p) => ({ ...p, showEnableBackups: false }));
                    refs.current.pendingPin = null; refs.current.discordState = null; return;
                  }
                }
              }
            } catch {}
            setBusy({ status: "Backing up…", isBusy: true });
            try {
              const payload = { ...refs.current.opts, ddbLink: (() => { try { return localStorage.getItem(STORAGE_KEYS.DDB_LINK); } catch { return null; } })() };
              const res = await backupToCloud(payload, uid, pending);
              const now = new Date(res.at || new Date().toISOString());
              const msg = `Backed up ${res.size ? `${formatBytes(res.size)} at ` : ""}${formatLocalTimestamp(now)}`;
              setUi((p) => ({ ...p, lastBackupISO: now.toISOString(), lastBackupSize: res.size || null, lastCloudAction: msg, showEnableBackups: false }));
              try { localStorage.setItem(STORAGE_LAST_BACKUP, now.toISOString()); if (res.size) localStorage.setItem(STORAGE_LAST_BACKUP_SIZE, String(res.size)); localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
              setBusy({ status: "", isBusy: false }); refs.current.pendingPin = null; refs.current.discordState = null;
            } catch (err: unknown) { const msg = err instanceof Error ? err.message : String(err); setBusy({ status: `Backup failed: ${msg.slice(0, 200)}`, isBusy: false }); }
          } else { setBusy({ status: "Discord login complete – set PIN to backup", isBusy: false }); setUi((p) => ({ ...p, showEnableBackups: true })); }
        } catch (err: unknown) { const msg = err instanceof Error ? err.message : String(err); setBusy({ status: `Discord sign-in failed: ${msg.slice(0, 200)}`, isBusy: false }); }
      } else if (data.type === "discord-auth-error") { setBusy({ status: `Discord auth failed: ${data.error || "unknown"}`, isBusy: false }); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setUser, setUi]);

  const onEnableBackups = useCallback((pin: string) => {
    if (!/^\d{6}$/.test(pin)) { setBusy({ status: "PIN must be 6 digits", isBusy: false }); return; }
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
    if (!clientId) { setBusy({ status: "Discord client ID not configured", isBusy: false }); return; }
    try {
      refs.current.pendingPin = pin;
      const state = crypto.randomUUID(); refs.current.discordState = state;
      const origin = typeof window !== "undefined" ? window.location.origin : "https://chants-506202.web.app";
      const redirect = origin.includes("localhost") ? `${origin}/api/discord-auth/callback` : "https://chants-506202.web.app/api/discord-auth/callback";
      const authUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=identify&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}&prompt=consent`;
      setBusy({ status: "Opening Discord login…", isBusy: true });
      const w = window.open(authUrl, "discord-auth", "width=480,height=720"); if (!w) window.location.href = authUrl;
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); setBusy({ status: `Enable failed: ${msg.slice(0, 200)}`, isBusy: false }); }
  }, []);

  const { onBackupAction, onDisable } = useBackupActions({
    user,
    setUser,
    ui,
    setUi,
    busy,
    setBusy,
    dlg,
    setDlg,
    optsRef: refs,
  });

  useBackupAutoSync({
    ui,
    setUi,
    user: { firebase: user.firebase },
    optsRef: refs,
    busy,
    lastSeenPayloadRef,
    lastBackedUpPayloadRef,
    isFirstAutoMountRef,
    autoTimerRef,
    opts,
  });

  return { user, status: busy.status, isBusy: busy.isBusy, ui, setUi, onEnableBackups, onBackupAction, onDisable, setStatus: (s: string) => setBusy((p) => ({ ...p, status: s })), pinDialog: { open: dlg.open && (dlg.mode === "backup" || dlg.mode === "restore"), mode: dlg.mode as "backup" | "restore", resolve: dlg.resolve as (v: string | null) => void }, setPinDialog: setDlg, confirmRestore: dlg, setConfirmRestore: setDlg };
}
