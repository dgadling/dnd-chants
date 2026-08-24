"use client";
import { useCallback } from "react";
import { getIdToken, signOutFirebase } from "@/lib/firebase-client";
import { deriveKeyFromPin, exportKeyToBase64, importKeyFromBase64, STORAGE_BACKUP_KEY } from "@/lib/backup-crypto";
import { formatBytes, formatLocalTimestamp, backupToCloud, restoreFromCloud, deleteCloudBackup, disableBackupsLocal, STORAGE_LAST_CLOUD_ACTION } from "@/lib/backup";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type Opts = { characters: unknown[]; schoolLangsPerChar: Record<string, unknown>; extrasPerChar: Record<string, unknown>; activeId: string; helpTemplate: string };
type Dialog = { open: boolean; mode: "backup" | "restore" | "confirm-restore"; resolve?: (v: string | boolean | null) => void };
type BackupUi = {
  showEnableBackups: boolean;
  lastBackupISO: string | null;
  lastBackupSize: number | null;
  lastCloudAction: string | null;
  backupEnabled: boolean;
};
type User = { firebase: { uid: string } | null; discord: { id: string; username: string; avatar?: string | null } | null };

export function useBackupActions(params: {
  user: User;
  setUser: (u: User) => void;
  ui: BackupUi;
  setUi: React.Dispatch<React.SetStateAction<BackupUi>>;
  busy: { status: string; isBusy: boolean };
  setBusy: React.Dispatch<React.SetStateAction<{ status: string; isBusy: boolean }>>;
  dlg: Dialog;
  setDlg: React.Dispatch<React.SetStateAction<Dialog>>;
  optsRef: React.MutableRefObject<{ opts: Opts }>;
}) {
  const { user, setUser, setUi, setBusy, setDlg, optsRef } = params;

  const onBackupAction = useCallback(async (action: "backup" | "restore") => {
    if (action === "backup") {
      try {
        const idTok = await getIdToken(); if (!idTok) { setBusy({ status: "Not signed in – enable backups first", isBusy: false }); return; }
        const uid = user.firebase?.uid || ""; let key: CryptoKey | null = null;
        try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
        if (!key) {
          const pin = await new Promise<string | null>((res) => setDlg({ open: true, mode: "backup", resolve: (v) => res(typeof v === "string" ? v : null) }));
          if (!pin || !/^\\d{6}$/.test(pin)) { setBusy({ status: "Backup cancelled – invalid PIN", isBusy: false }); setDlg({ open: false, mode: "backup" }); return; }
          key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); setDlg({ open: false, mode: "backup" });
        }
        setBusy({ status: "Backing up…", isBusy: true });
        const payload = { ...optsRef.current.opts, ddbLink: (() => { try { return localStorage.getItem(STORAGE_KEYS.DDB_LINK); } catch { return null; } })() };
        const res = await backupToCloud(payload, uid); const now = new Date(res.at || new Date().toISOString());
        const msg = `Backed up ${res.size ? `${formatBytes(res.size)} at ` : ""}${formatLocalTimestamp(now)}`;
        setUi((p) => ({ ...p, lastBackupISO: now.toISOString(), lastBackupSize: res.size || null, lastCloudAction: msg }));
        try { localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now.toISOString()); if (res.size) localStorage.setItem(STORAGE_KEYS.LAST_BACKUP_SIZE, String(res.size)); localStorage.setItem(STORAGE_KEYS.LAST_CLOUD_ACTION, msg); } catch {}
        setBusy({ status: "", isBusy: false });
      } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); setBusy({ status: `Backup failed: ${msg.slice(0, 200)}`, isBusy: false }); }
    } else {
      try {
        const idTok = await getIdToken(); if (!idTok) { setBusy({ status: "Not signed in – enable backups first", isBusy: false }); return; }
        setBusy({ status: "Fetching backup…", isBusy: true });
        const uid = user.firebase?.uid || ""; let key: CryptoKey | null = null;
        try { const b64 = localStorage.getItem(STORAGE_BACKUP_KEY); if (b64) key = await importKeyFromBase64(b64); } catch {}
        if (!key) {
          const pin = await new Promise<string | null>((res) => setDlg({ open: true, mode: "restore", resolve: (v) => res(typeof v === "string" ? v : null) }));
          if (!pin || !/^\\d{6}$/.test(pin)) { setBusy({ status: "Restore cancelled – invalid PIN", isBusy: false }); setDlg({ open: false, mode: "restore" }); return; }
          key = await deriveKeyFromPin(pin, uid); localStorage.setItem(STORAGE_BACKUP_KEY, await exportKeyToBase64(key)); setDlg({ open: false, mode: "restore" });
        }
        const restored = await restoreFromCloud(uid); const data = restored.data as Record<string, unknown>; const cloudSize = restored.size;
        if (Array.isArray((data as any).characters)) localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify((data as any).characters));
        if ((data as any).schoolLangsPerChar) localStorage.setItem(STORAGE_KEYS.SCHOOL_LANGS, JSON.stringify((data as any).schoolLangsPerChar));
        if ((data as any).extrasPerChar) localStorage.setItem(STORAGE_KEYS.EXTRAS, JSON.stringify((data as any).extrasPerChar));
        if (typeof (data as any).activeId === "string") localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, (data as any).activeId);
        if (typeof (data as any).helpTemplate === "string") localStorage.setItem(STORAGE_KEYS.HELP_TEMPLATE, (data as any).helpTemplate);
        if ((data as any).ddbLink) try { localStorage.setItem(STORAGE_KEYS.DDB_LINK, (data as any).ddbLink); } catch {}
        const now = new Date(); const msg = `Restored ${cloudSize ? `${formatBytes(cloudSize)} at ` : ""}${formatLocalTimestamp(now)}`;
        setUi((p) => ({ ...p, lastCloudAction: msg })); try { localStorage.setItem(STORAGE_LAST_CLOUD_ACTION, msg); } catch {}
        setBusy({ status: "Restore complete – reloading", isBusy: false }); setTimeout(() => window.location.reload(), 500);
      } catch (e: unknown) { const m = String((e as Error)?.message || e); setBusy({ status: m.includes("Wrong PIN") ? m : `Restore failed: ${m.slice(0, 200)}`, isBusy: false }); }
    }
  }, [user.firebase, setUi, setBusy, setDlg, optsRef]);

  const onDisable = useCallback(async (mode: "disable" | "delete" = "disable") => {
    if (mode === "delete") {
      if (!window.confirm("Delete cloud backup? This cannot be undone.")) return;
      try { await deleteCloudBackup(); setBusy({ status: "Cloud backup deleted", isBusy: false }); setUi((p) => ({ ...p, lastBackupISO: null, lastBackupSize: null, lastCloudAction: null })); try { localStorage.removeItem(STORAGE_LAST_CLOUD_ACTION); } catch {} } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); setBusy({ status: `Delete failed: ${msg.slice(0, 200)}`, isBusy: false }); } return;
    }
    if (!window.confirm("Disable backups on this device? You will need PIN and Discord login to restore again.")) return;
    try { await signOutFirebase(); } catch {}
    setUser({ firebase: null, discord: null }); setUi({ showEnableBackups: false, lastBackupISO: null, lastBackupSize: null, lastCloudAction: null, backupEnabled: false });
    disableBackupsLocal(); try { localStorage.removeItem(STORAGE_KEYS.DISCORD_USER); localStorage.removeItem(STORAGE_LAST_CLOUD_ACTION); } catch {} setBusy({ status: "Backups disabled on this device", isBusy: false });
  }, [setUser, setUi, setBusy]);

  return { onBackupAction, onDisable };
}
