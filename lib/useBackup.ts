"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken, signInWithDiscordCustomToken, signOutFirebase } from "@/lib/firebase-client";
import { deriveKeyFromPin, exportKeyToBase64, importKeyFromBase64, STORAGE_BACKUP_KEY } from "@/lib/backup-crypto";
import { isAllowedOrigin, STORAGE_BACKUP_ENABLED, STORAGE_LAST_BACKUP, STORAGE_LAST_BACKUP_SIZE, STORAGE_LAST_CLOUD_ACTION, formatBytes, formatLocalTimestamp, backupToCloud, restoreFromCloud, deleteCloudBackup, disableBackupsLocal } from "@/lib/backup";
import { useDiscordAuth } from "@/hooks/useDiscordAuth";
import { useBackupState } from "@/hooks/useBackupState";

type Opts = { characters: unknown[]; schoolLangsPerChar: Record<string, unknown>; extrasPerChar: Record<string, unknown>; activeId: string; helpTemplate: string };
type Dialog = { open: boolean; mode: "backup" | "restore" | "confirm-restore"; resolve?: (v: string | boolean | null) => void };

export function useBackup(opts: Opts) {
  const { user, setUser } = useDiscordAuth();
  const { ui, setUi } = useBackupState();
  const [busy, setBusy] = useState<{ status: string; isBusy: boolean }>({ status: "", isBusy: false });
  const [dlg, setDlg] = useState<Dialog>({ open: false, mode: "backup" });
  const refs = useRef<{ opts: Opts; pendingPin: string | null; discordState: string | null }>({ opts, pendingPin: null, discordState: null });

  useEffect(() => { refs.current.opts = opts; }, [opts]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (!isAllowedOrigin(e.origin)) return;
      const d: any = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "discord-auth-success" && d.customToken) {
        const exp = refs.current.discordState;
        if (!exp || !d.state || d.state !== exp) { setBusy({ status: "Discord state mismatch – try again", isBusy: false }); return; }
        try {
          setBusy({ status: "Signing in with Discord…", isBusy: true });
          const fb = await signInWithDiscordCustomToken(d.customToken);
          const du = d.discordUser ? { id: d.discordUser.id, username: d.discordUser.username, avatar: d.discordUser.avatar } : null;
          setUser({ firebase: fb, discord: du });
          if (du) { try { localStorage.setItem("dnd-chant-discord-user-v1", JSON.stringify(du)); } catch {} }
          try { localStorage.setItem(STORAGE_BACKUP_ENABLED, "1"); } catch {}
          setUi((p) => ({ ...p, backupEnabled: true }));
          const pending = refs.current.pendingPin;
          if (pending && /^\d{6}$/.test(pending)) {
            const uid = (fb as any)?.uid || `discord:${d.discordUser?.id || ""}`;
            const key = await deriveKeyFromPin(pending, uid);
            localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key));
            try {
              const idTok = await getIdToken();
              if (idTok) {
                const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 5000);
                const chk = await fetch("/api/backup", { method: "GET", headers: { Authorization: `Bearer ${idTok}` }, signal: ac.signal as any });
                clearTimeout(t);
                if (chk.status === 200) {
                  const doRestore = await new Promise<boolean>((res) => setDlg({ open: true, mode: "confirm-restore", resolve: (v) => res(!!v) }));
                  setDlg({ open: false, mode: "confirm-restore" });
                  if (doRestore) {
                    setBusy({ status: "Restoring existing backup…", isBusy: true });
                    try {
                      const restored = await restoreFromCloud(uid, pending);
                      const data = restored.data; const cloudSize = restored.size;
                      if (Array.isArray(data.characters)) localStorage.setItem("dnd-chant-characters-v1", JSON.stringify(data.characters));
                      if (data.schoolLangsPerChar) localStorage.setItem("dnd-chant-school-langs-v1", JSON.stringify(data.schoolLangsPerChar));
                      if (data.extrasPerChar) localStorage.setItem("dnd-chant-extras-v1", JSON.stringify(data.extrasPerChar));
                      if (typeof data.activeId === "string") localStorage.setItem("dnd-chant-active-character-v1", data.activeId);
                      if (typeof data.helpTemplate === "string") localStorage.setItem("dnd-chant-help-template-v1", data.helpTemplate);
                      if (data.ddbLink) try { localStorage.setItem("dnd-chant-ddb-link-v1", data.ddbLink); } catch {}
                      const now = new Date(); const msg = `Restored ${cloudSize ? `${formatBytes(cloudSize)} at ` : ""}${formatLocalTimestamp(now)}`;
                      setUi((p) => ({ ...p, lastCloudAction: msg, showEnableBackups: false }));
                      try { localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
                      setBusy({ status: "Restore complete – reloading", isBusy: false });
                      refs.current.pendingPin = null; refs.current.discordState = null;
                      setTimeout(() => window.location.reload(), 500); return;
                    } catch (re: any) {
                      const rm = String(re?.message || re);
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
              const payload = { ...refs.current.opts, ddbLink: (() => { try { return localStorage.getItem("dnd-chant-ddb-link-v1"); } catch { return null; } })() };
              const res = await backupToCloud(payload, uid, pending);
              const now = new Date(res.at || new Date().toISOString());
              const msg = `Backed up ${res.size ? `${formatBytes(res.size)} at ` : ""}${formatLocalTimestamp(now)}`;
              setUi((p) => ({ ...p, lastBackupISO: now.toISOString(), lastBackupSize: res.size || null, lastCloudAction: msg, showEnableBackups: false }));
              try { localStorage.setItem(STORAGE_LAST_BACKUP, now.toISOString()); if (res.size) localStorage.setItem(STORAGE_LAST_BACKUP_SIZE, String(res.size)); localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
              setBusy({ status: "", isBusy: false }); refs.current.pendingPin = null; refs.current.discordState = null;
            } catch (err: any) { setBusy({ status: `Backup failed: ${String(err?.message || err).slice(0, 200)}`, isBusy: false }); }
          } else { setBusy({ status: "Discord login complete – set PIN to backup", isBusy: false }); setUi((p) => ({ ...p, showEnableBackups: true })); }
        } catch (err: any) { setBusy({ status: `Discord sign-in failed: ${String(err?.message || err).slice(0, 200)}`, isBusy: false }); }
      } else if (d.type === "discord-auth-error") { setBusy({ status: `Discord auth failed: ${d.error || "unknown"}`, isBusy: false }); }
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
    } catch (e: any) { setBusy({ status: `Enable failed: ${String(e?.message || e).slice(0, 200)}`, isBusy: false }); }
  }, []);

  const onBackupAction = useCallback(async (action: "backup" | "restore") => {
    if (action === "backup") {
      try {
        const idTok = await getIdToken(); if (!idTok) { setBusy({ status: "Not signed in – enable backups first", isBusy: false }); return; }
        const uid = (user.firebase as any)?.uid || ""; let key: CryptoKey | null = null;
        try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
        if (!key) {
          const pin = await new Promise<string | null>((res) => setDlg({ open: true, mode: "backup", resolve: (v) => res(typeof v === "string" ? v : null) }));
          if (!pin || !/^\d{6}$/.test(pin)) { setBusy({ status: "Backup cancelled – invalid PIN", isBusy: false }); setDlg({ open: false, mode: "backup" }); return; }
          key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); setDlg({ open: false, mode: "backup" });
        }
        setBusy({ status: "Backing up…", isBusy: true });
        const payload = { ...refs.current.opts, ddbLink: (() => { try { return localStorage.getItem("dnd-chant-ddb-link-v1"); } catch { return null; } })() };
        const res = await backupToCloud(payload, uid); const now = new Date(res.at || new Date().toISOString());
        const msg = `Backed up ${res.size ? `${formatBytes(res.size)} at ` : ""}${formatLocalTimestamp(now)}`;
        setUi((p) => ({ ...p, lastBackupISO: now.toISOString(), lastBackupSize: res.size || null, lastCloudAction: msg }));
        try { localStorage.setItem(STORAGE_LAST_BACKUP, now.toISOString()); if (res.size) localStorage.setItem(STORAGE_LAST_BACKUP_SIZE, String(res.size)); localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
        setBusy({ status: "", isBusy: false });
      } catch (e: any) { setBusy({ status: `Backup failed: ${String(e?.message || e).slice(0, 200)}`, isBusy: false }); }
    } else {
      try {
        const idTok = await getIdToken(); if (!idTok) { setBusy({ status: "Not signed in – enable backups first", isBusy: false }); return; }
        setBusy({ status: "Fetching backup…", isBusy: true });
        const uid = (user.firebase as any)?.uid || ""; let key: CryptoKey | null = null;
        try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
        if (!key) {
          const pin = await new Promise<string | null>((res) => setDlg({ open: true, mode: "restore", resolve: (v) => res(typeof v === "string" ? v : null) }));
          if (!pin || !/^\d{6}$/.test(pin)) { setBusy({ status: "Restore cancelled – invalid PIN", isBusy: false }); setDlg({ open: false, mode: "restore" }); return; }
          key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); setDlg({ open: false, mode: "restore" });
        }
        const restored = await restoreFromCloud(uid); const data = restored.data; const cloudSize = restored.size;
        if (Array.isArray(data.characters)) localStorage.setItem("dnd-chant-characters-v1", JSON.stringify(data.characters));
        if (data.schoolLangsPerChar) localStorage.setItem("dnd-chant-school-langs-v1", JSON.stringify(data.schoolLangsPerChar));
        if (data.extrasPerChar) localStorage.setItem("dnd-chant-extras-v1", JSON.stringify(data.extrasPerChar));
        if (typeof data.activeId === "string") localStorage.setItem("dnd-chant-active-character-v1", data.activeId);
        if (typeof data.helpTemplate === "string") localStorage.setItem("dnd-chant-help-template-v1", data.helpTemplate);
        if (data.ddbLink) try { localStorage.setItem("dnd-chant-ddb-link-v1", data.ddbLink); } catch {}
        const now = new Date(); const msg = `Restored ${cloudSize ? `${formatBytes(cloudSize)} at ` : ""}${formatLocalTimestamp(now)}`;
        setUi((p) => ({ ...p, lastCloudAction: msg })); try { localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
        setBusy({ status: "Restore complete – reloading", isBusy: false }); setTimeout(() => window.location.reload(), 500);
      } catch (e: any) { const m = String(e?.message || e); setBusy({ status: m.includes("Wrong PIN") ? m : `Restore failed: ${m.slice(0, 200)}`, isBusy: false }); }
    }
  }, [user.firebase, setUi]);

  const onDisable = useCallback(async (mode: "disable" | "delete" = "disable") => {
    if (mode === "delete") {
      if (!window.confirm("Delete cloud backup? This cannot be undone.")) return;
      try { await deleteCloudBackup(); setBusy({ status: "Cloud backup deleted", isBusy: false }); setUi((p) => ({ ...p, lastBackupISO: null, lastBackupSize: null, lastCloudAction: null })); try { localStorage.removeItem(STORAGE_LAST_CLOUD_ACTION); } catch {} } catch (e: any) { setBusy({ status: `Delete failed: ${String(e?.message || e).slice(0, 200)}`, isBusy: false }); } return;
    }
    if (!window.confirm("Disable backups on this device? You will need PIN and Discord login to restore again.")) return;
    try { await signOutFirebase(); } catch {}
    setUser({ firebase: null, discord: null }); setUi({ showEnableBackups: false, lastBackupISO: null, lastBackupSize: null, lastCloudAction: null, backupEnabled: false });
    disableBackupsLocal(); try { localStorage.removeItem("dnd-chant-discord-user-v1"); localStorage.removeItem(STORAGE_LAST_CLOUD_ACTION); } catch {} setBusy({ status: "Backups disabled on this device", isBusy: false });
  }, [setUser, setUi]);

  return { user, status: busy.status, isBusy: busy.isBusy, ui, setUi, onEnableBackups, onBackupAction, onDisable, setStatus: (s: string) => setBusy((p) => ({ ...p, status: s })), pinDialog: { open: dlg.open && (dlg.mode === "backup" || dlg.mode === "restore"), mode: dlg.mode as any, resolve: dlg.resolve as any }, setPinDialog: setDlg, confirmRestore: dlg, setConfirmRestore: setDlg };
}
