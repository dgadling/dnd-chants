"use client";
import { useEffect, useState } from "react";
import { onAuthChanged } from "@/lib/firebase-client";
import { STORAGE_BACKUP_ENABLED } from "@/lib/backup";

type DiscordUser = { id: string; username: string; avatar?: string | null } | null;

export function useDiscordAuth() {
  const [user, setUser] = useState<{ firebase: any; discord: DiscordUser }>({
    firebase: null,
    discord: null,
  });

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = onAuthChanged(async (fb: any) => {
        if (fb) {
          let restored: DiscordUser = null;
          try {
            const raw = localStorage.getItem("dnd-chant-discord-user-v1");
            if (raw) {
              const j = JSON.parse(raw);
              if (j?.id) restored = { id: String(j.id), username: String(j.username || ""), avatar: j.avatar || null };
            }
          } catch {}
          if (!restored) {
            try {
              const tr = await fb?.getIdTokenResult?.();
              const c = tr?.claims;
              if (c?.discordId) restored = { id: String(c.discordId), username: String(c.discordUsername || ""), avatar: c.discordAvatar || null };
            } catch {}
          }
          setUser((p) => ({
            firebase: fb,
            discord: p.discord || restored || (fb.uid?.startsWith("discord:") ? { id: fb.uid.slice(8), username: restored?.username || "", avatar: restored?.avatar || null } : null),
          }));
          if (restored) {
            try { localStorage.setItem("dnd-chant-discord-user-v1", JSON.stringify(restored)); } catch {}
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
