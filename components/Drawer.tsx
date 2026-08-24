"use client";
import { useTheme } from "@/lib/useTheme";
import { formatBytes, formatLocalTimestamp } from "@/lib/backup";
import { DRAWER_WIDTH_MOBILE, DRAWER_WIDTH_DESKTOP } from "@/lib/constants";

type StoredCharacter = {
  characterId: string;
  characterName: string;
  lastFetchISO: string;
  lastModifiedISO: string | null;
  spells: any[];
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = now - then;
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso || "unknown";
  }
}

type Props = {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  characters: StoredCharacter[];
  activeId: string;
  hasChars: boolean;
  onSwitchCharacter: (id: string) => void;
  onRemoveCharacter: (id: string) => void;
  setShowAddCharacter: (v: boolean) => void;
  setShowHelpConfig: (v: boolean) => void;
  setShowPrivacy: (v: boolean) => void;
  lastFetchISO: string;
  lastModifiedISO: string | null;
  isLinking: boolean;
  onRefreshClick: () => void;
  backup: any;
};

export function Drawer({
  drawerOpen,
  setDrawerOpen,
  characters,
  activeId,
  hasChars,
  onSwitchCharacter,
  onRemoveCharacter,
  setShowAddCharacter,
  setShowHelpConfig,
  setShowPrivacy,
  lastFetchISO,
  lastModifiedISO,
  isLinking,
  onRefreshClick,
  backup,
}: Props) {
  const theme = useTheme();

  return (
    <>
      <style>{`@media(min-width:1024px){aside[data-drawer]{width:${DRAWER_WIDTH_DESKTOP}px !important}}`}</style>
      <aside
        data-drawer
        style={{ width: DRAWER_WIDTH_MOBILE }}
        className={`fixed inset-y-0 left-0 z-40 max-w-[85vw] border-r flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:max-w-none lg:shrink-0 lg:w-[240px] ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } bg-surface border-default text-primary`}
      >
      <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0 border-default">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-7 w-7 rounded-lg grid place-items-center font-bold text-[13px] bg-accent`}>D</div>
          <span className="font-semibold tracking-tight text-[15px]">D&D Chants</span>
        </div>
        <button
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden h-8 w-8 grid place-items-center rounded-lg bg-surface bg-surface-hover text-dim"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[11px] uppercase tracking-widest font-semibold text-dim">Characters</h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border bg-surface border-default text-dim ${hasChars ? "" : "hidden"}`}>
              {characters.length}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {!hasChars ? (
              <div className="text-[12px] px-2 py-3 rounded-lg border border-dashed text-dim bg-surface border-default">
                No characters yet. Add your first D&D Beyond character to begin.
              </div>
            ) : (
              characters.map((c) => {
                const isActive = activeId === c.characterId || (!activeId && characters[0]?.characterId === c.characterId);
                const isExpanded = isActive;
                const fetchText = isActive ? formatRelative(lastFetchISO) : "";
                const modText = isActive && lastModifiedISO ? formatRelative(lastModifiedISO) : null;
                return (
                  <div
                    key={c.characterId}
                    className={`group flex flex-col rounded-xl border transition-colors ${
                      isActive ? "active-row p-2.5" : "bg-surface border-default text-primary bg-surface-hover px-2.5 py-2"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        className="flex-1 min-w-0 text-left flex items-center gap-1.5"
                        onClick={() => onSwitchCharacter(c.characterId)}
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "accent-dot" : "bg-surface-hover"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{c.characterName || `Char ${c.characterId}`}</div>
                        </div>
                      </button>

                      <span className="text-[10px] hidden sm:inline text-dim">·{c.spells.length}</span>

                      <a
                        href={`https://www.dndbeyond.com/characters/${c.characterId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-6 w-6 grid place-items-center rounded-md shrink-0 bg-surface bg-surface-hover text-dim"
                        title="Open in D&D Beyond"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>

                      <button
                        className="h-6 w-6 grid place-items-center rounded-md text-[13px] shrink-0 bg-surface bg-surface-hover text-dim"
                        onClick={(e) => { e.stopPropagation(); onRemoveCharacter(c.characterId); }}
                        aria-label={`Delete ${c.characterName || c.characterId}`}
                      >
                        ×
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="mt-2 pt-2 border-t space-y-1 border-default">
                        <div className="text-[11px] text-dim">Last fetch {fetchText}</div>
                        {modText ? <div className="text-[11px] text-dim">Sheet modified {modText}</div> : null}
                        <button
                          onClick={onRefreshClick}
                          disabled={isLinking}
                          className="w-full mt-2 inline-flex items-center justify-center gap-1.5 border rounded-lg text-[12px] h-8 px-3 disabled:opacity-60 bg-surface border-default text-primary bg-surface-hover"
                        >
                          <span>↻</span>
                          <span>{isLinking ? "Refreshing…" : "Refresh"}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => setShowAddCharacter(true)}
            className="mt-3 w-full text-[13px] px-3 py-2.5 rounded-lg border border-dashed transition-colors font-medium flex items-center justify-center gap-1.5 border-default text-dim bg-surface-hover"
          >
            <span className="text-[14px]">+</span> Add Character
          </button>

          <button
            onClick={() => setShowHelpConfig(true)}
            className="mt-2 w-full text-[12px] px-3 py-2 rounded-lg border transition-colors font-medium flex items-center justify-center gap-1.5 bg-surface border-default text-dim bg-surface-hover"
          >
            ⚙ Configure help
          </button>

          <div className="mt-4 pt-4 border-t border-default">
            <h3 className="text-[11px] uppercase tracking-widest font-semibold mb-2 px-1 text-dim">Theme</h3>
            <div className="flex rounded-lg p-1 gap-1 bg-surface">
              {(["auto","light","dark"] as const).map(v=> {
                const active = theme.pref===v;
                return (
                  <button
                    key={v}
                    onClick={()=>theme.setPref(v)}
                    className={`flex-1 text-[11px] px-2 py-1.5 rounded-md font-medium capitalize transition-colors ${active ? "bg-surface border border-default text-primary shadow-sm" : "text-dim bg-surface-hover"}`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-default">
            <h3 className="text-[11px] uppercase tracking-widest font-semibold mb-2 px-1 text-dim">Cloud Backup</h3>
            {!backup.ui.backupEnabled ? (
              <>
                <button
                  onClick={() => backup.setUi((p: any) => ({ ...p, showEnableBackups: true }))}
                  className="w-full text-[12px] px-3 py-2.5 rounded-lg border transition-colors font-medium flex items-center justify-center gap-1.5 bg-surface border-default text-primary bg-surface-hover"
                >
                  ☁️ Enable backups
                </button>
                <div className="text-[10px] mt-1.5 px-1 leading-snug text-dim">
                  Encrypted with 6-digit PIN. We cannot see what we are storing. It is not perfect, but it is private.
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {backup.user.discord ? (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-surface border-default">
                    {backup.user.discord.avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${backup.user.discord.id}/${backup.user.discord.avatar}.png?size=64`}
                        alt={backup.user.discord.username || "Discord"}
                        className="h-6 w-6 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-indigo-500 grid place-items-center text-[11px] font-bold text-white shrink-0">
                        {backup.user.discord.username ? backup.user.discord.username.slice(0,1).toUpperCase() : "D"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium truncate text-primary">{backup.user.discord.username || "Discord user"}</div>
                      <div className="text-[10px] text-dim">Backup enabled</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] px-1 text-dim">Backup enabled</div>
                )}

                <button
                  onClick={() => backup.onBackupAction("backup")}
                  className="w-full text-[12px] px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 btn-accent"
                >
                  ↑ Backup now
                </button>

                <button
                  onClick={() => backup.onBackupAction("restore")}
                  className="w-full text-[12px] px-3 py-2 rounded-lg border transition-colors bg-surface border-default text-primary bg-surface-hover"
                >
                  ↓ Restore
                </button>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => backup.onDisable("delete")}
                    className="flex-1 text-[11px] px-2 py-1.5 rounded-md bg-surface text-dim bg-surface-hover"
                  >
                    Delete cloud
                  </button>
                  <button
                    onClick={() => backup.onDisable("disable")}
                    className="flex-1 text-[11px] px-2 py-1.5 rounded-md bg-surface text-dim bg-surface-hover"
                  >
                    Disable
                  </button>
                </div>

                {backup.ui.lastCloudAction ? <div className="text-[10px] px-1 text-dim">{backup.ui.lastCloudAction}</div> : null}
                {backup.status ? <div className="text-[10px] px-1 break-words text-accent-soft">{backup.status}</div> : null}
              </div>
            )}
            {!backup.ui.backupEnabled && backup.status ? <div className="text-[10px] mt-2 px-1 break-words text-accent-soft">{backup.status}</div> : null}
          </div>
        </div>
      </div>

      <div className="px-3 py-3 border-t text-[11px] border-default text-dim flex flex-col gap-1">
        <button
          onClick={() => setShowPrivacy(true)}
          className="text-[11px] underline underline-offset-2 text-dim text-left"
        >
          Privacy Policy
        </button>
        <a href="/how-we-store" className="text-[11px] underline underline-offset-2 text-dim">
          How we store your data
        </a>
        <a href="https://github.com/dgadling/dnd-chants" target="_blank" rel="noopener noreferrer" className="text-[11px] underline underline-offset-2 text-dim">
          GitHub
        </a>
      </div>
    </aside>
    </>
  );
}
