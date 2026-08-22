"use client";
import { useEffect, useState } from "react";
import { STORAGE_BACKUP_ENABLED, STORAGE_LAST_BACKUP, STORAGE_LAST_BACKUP_SIZE, STORAGE_LAST_CLOUD_ACTION } from "@/lib/backup";

export type BackupUi = {
  showEnableBackups: boolean;
  lastBackupISO: string | null;
  lastBackupSize: number | null;
  lastCloudAction: string | null;
  backupEnabled: boolean;
};

export function useBackupState() {
  const [ui, setUi] = useState<BackupUi>({
    showEnableBackups: false,
    lastBackupISO: null,
    lastBackupSize: null,
    lastCloudAction: null,
    backupEnabled: false,
  });

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_BACKUP_ENABLED) === "1") setUi((p) => ({ ...p, backupEnabled: true }));
      const lb = localStorage.getItem(STORAGE_LAST_BACKUP);
      if (lb) setUi((p) => ({ ...p, lastBackupISO: lb }));
      const sz = localStorage.getItem(STORAGE_LAST_BACKUP_SIZE);
      if (sz) { const n = parseInt(sz, 10); if (!isNaN(n)) setUi((p) => ({ ...p, lastBackupSize: n })); }
      const la = localStorage.getItem(STORAGE_LAST_CLOUD_ACTION);
      if (la) setUi((p) => ({ ...p, lastCloudAction: la }));
    } catch {}
  }, []);

  return { ui, setUi };
}
