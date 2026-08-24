"use client";
import { useEffect, useRef } from "react";
import { STORAGE_BACKUP_KEY } from "@/lib/backup-crypto";
import { formatBytes, formatLocalTimestamp, backupToCloud } from "@/lib/backup";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type Opts = { characters: unknown[]; schoolLangsPerChar: Record<string, unknown>; extrasPerChar: Record<string, unknown>; activeId: string; helpTemplate: string };

type BackupUi = {
  showEnableBackups: boolean;
  lastBackupISO: string | null;
  lastBackupSize: number | null;
  lastCloudAction: string | null;
  backupEnabled: boolean;
};

type User = { firebase: { uid: string } | null };

export function useBackupAutoSync(params: {
  ui: BackupUi;
  setUi: React.Dispatch<React.SetStateAction<BackupUi>>;
  user: User;
  optsRef: React.MutableRefObject<{ opts: Opts }>;
  busy: { isBusy: boolean };
  lastSeenPayloadRef: React.MutableRefObject<string | null>;
  lastBackedUpPayloadRef: React.MutableRefObject<string | null>;
  isFirstAutoMountRef: React.MutableRefObject<boolean>;
  autoTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  opts: Opts;
}) {
  const { ui, setUi, user, optsRef, busy, lastSeenPayloadRef, lastBackedUpPayloadRef, isFirstAutoMountRef, autoTimerRef, opts } = params;

  useEffect(() => {
    if (!ui.backupEnabled) return;
    if (!user.firebase) return;
    if (busy.isBusy) return;
    let hasKey = false;
    try { hasKey = !!localStorage.getItem(STORAGE_BACKUP_KEY); } catch {}
    if (!hasKey) return;

    let ddbLink: string | null = null;
    try { ddbLink = localStorage.getItem(STORAGE_KEYS.DDB_LINK); } catch {}
    const payload = { ...optsRef.current.opts, ddbLink };
    let payloadStr: string;
    try { payloadStr = JSON.stringify(payload); } catch { return; }

    if (isFirstAutoMountRef.current) {
      isFirstAutoMountRef.current = false;
      lastSeenPayloadRef.current = payloadStr;
      lastBackedUpPayloadRef.current = payloadStr;
      return;
    }

    if (payloadStr === lastSeenPayloadRef.current) return;
    lastSeenPayloadRef.current = payloadStr;
    if (payloadStr === lastBackedUpPayloadRef.current) return;

    if (autoTimerRef.current) clearTimeout(autoTimerRef.current as ReturnType<typeof setTimeout>);
    autoTimerRef.current = setTimeout(async () => {
      if (busy.isBusy) return;
      if (!ui.backupEnabled) return;
      try { if (!localStorage.getItem(STORAGE_BACKUP_KEY)) return; } catch { return; }
      const uid = user.firebase?.uid || "";
      if (!uid) return;
      try {
        let freshDdbLink: string | null = null;
        try { freshDdbLink = localStorage.getItem(STORAGE_KEYS.DDB_LINK); } catch {}
        const freshPayload = { ...optsRef.current.opts, ddbLink: freshDdbLink };
        const res = await backupToCloud(freshPayload, uid);
        const now = new Date(res.at || new Date().toISOString());
        const msg = `Backed up ${res.size ? `${formatBytes(res.size)} at ` : ""}${formatLocalTimestamp(now)}`;
        setUi((p) => ({ ...p, lastBackupISO: now.toISOString(), lastBackupSize: res.size || null, lastCloudAction: msg }));
        try { localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now.toISOString()); if (res.size) localStorage.setItem(STORAGE_KEYS.LAST_BACKUP_SIZE, String(res.size)); localStorage.setItem(STORAGE_KEYS.LAST_CLOUD_ACTION, msg); } catch {}
        try { lastBackedUpPayloadRef.current = JSON.stringify(freshPayload); } catch { lastBackedUpPayloadRef.current = payloadStr; }
      } catch {
        // silent fail for auto backup
      }
    }, 5000) as unknown as ReturnType<typeof setTimeout>;

    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current as ReturnType<typeof setTimeout>); };
  }, [ui.backupEnabled, user.firebase, opts, busy.isBusy, setUi, optsRef, lastSeenPayloadRef, lastBackedUpPayloadRef, isFirstAutoMountRef, autoTimerRef]);

  useEffect(() => {
    if (!ui.lastBackupISO) return;
    try {
      let ddbLink: string | null = null;
      try { ddbLink = localStorage.getItem(STORAGE_KEYS.DDB_LINK); } catch {}
      const payload = { ...optsRef.current.opts, ddbLink };
      lastBackedUpPayloadRef.current = JSON.stringify(payload);
      lastSeenPayloadRef.current = lastBackedUpPayloadRef.current;
    } catch {}
  }, [ui.lastBackupISO, optsRef, lastBackedUpPayloadRef, lastSeenPayloadRef]);
}
