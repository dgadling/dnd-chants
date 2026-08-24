"use client";
import { useEffect, useState } from "react";
import { onAuthChanged } from "@/lib/firebase-client";
import { STORAGE_BACKUP_ENABLED } from "@/lib/backup";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type DiscordUser = { id: string; username: string; avatar?: string | null } | null;

type FirebaseUser = { uid: string; getIdTokenResult?: () => Promise<{ claims?: Record<string, unknown> }>; };

function isValidDiscordUser(o: unknown): o is { id: string; username: string; avatar?: string | null } {
  if (!o || typeof o !== "object") return false;
  const obj = o as Record<string, unknown>;
  return typeof obj.id === "string" && obj.id.length > 0 && typeof obj.username === "string";
}

export function useDiscordAuth() {
  const [user, setUser] = useState<{ firebase: FirebaseUser | null; discord: DiscordUser }>({
    firebase: null,
    discord: null,
  });

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = onAuthChanged(async (fb: FirebaseUser | null) => {
        if (fb) {
          let restored: DiscordUser = null;
          try {
            const raw = localStorage.getItem(STORAGE_KEYS.DISCORD_USER);
            if (raw) {
              const parsed: unknown = JSON.parse(raw);
              if (isValidDiscordUser(parsed)) {
                restored = { id: String(parsed.id), username: String(parsed.username || ""), avatar: (parsed as any).avatar || null };
              }
            }
          } catch {}
          if (!restored) {
            try {
              const tr = await fb?.getIdTokenResult?.();
              const c = tr?.claims as Record<string, unknown> | undefined;
              if (c?.discordId) restored = { id: String(c.discordId), username: String(c.discordUsername || ""), avatar: (c.discordAvatar as string) || null };
            } catch {}
          }
          setUser((p) => ({
            firebase: fb,
            discord: p.discord || restored || (fb.uid?.startsWith("discord:") ? { id: fb.uid.slice(8), username: restored?.username || "", avatar: restored?.avatar || null } : null),
          }));
          if (restored) {
            try { localStorage.setItem(STORAGE_KEYS.DISCORD_USER, JSON.stringify(restored)); } catch {}
          }
          try { localStorage.setItem(STORAGE_BACKUP_ENABLED, "1"); } catch {}
        } else {
          setUser((p) => ({ firebase: null, discord: p.discord }));
        }
      });
    } catch {}
    return () => { if (unsub) unsub(); };
  }, []);

  return { user, setUser };
}
