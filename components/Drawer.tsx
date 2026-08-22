"use client";
import { useTheme } from "@/lib/useTheme";
import { formatBytes, formatLocalTimestamp } from "@/lib/backup";

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
  const isLight = theme.actual === "light";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[300px] max-w-[85vw] border-r flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:w-[240px] lg:max-w-none lg:shrink-0 ${
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      } ${isLight ? "bg-white border-zinc-200 text-zinc-900" : "bg-zinc-800 border-zinc-700 text-zinc-100"}`}
    >
      <div className={`flex items-center justify-between px-4 py-3.5 border-b shrink-0 ${isLight ? "border-zinc-200" : "border-zinc-700"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-7 w-7 rounded-lg grid place-items-center font-bold text-[13px] bg-accent`}>D</div>
          <span className="font-semibold tracking-tight text-[15px]">D&D Chants</span>
        </div>
        <button
          onClick={() => setDrawerOpen(false)}
          className={`lg:hidden h-8 w-8 grid place-items-center rounded-lg ${isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-600" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"}`}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className={`text-[11px] uppercase tracking-widest font-semibold ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>Characters</h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${isLight ? "bg-zinc-50 border-zinc-200 text-zinc-500" : "bg-zinc-900 border-zinc-700 text-zinc-500"} ${hasChars ? "" : "hidden"}`}>
              {characters.length}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {!hasChars ? (
              <div className={`text-[12px] px-2 py-3 rounded-lg border border-dashed ${isLight ? "text-zinc-500 bg-zinc-50 border-zinc-300/70" : "text-zinc-500 bg-zinc-900/60 border-zinc-700/60"}`}>
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
                      isActive ? "active-row p-2.5" : (isLight ? "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 px-2.5 py-2" : "bg-zinc-900/40 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700/50 hover:border-zinc-600 px-2.5 py-2")
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        className="flex-1 min-w-0 text-left flex items-center gap-1.5"
                        onClick={() => onSwitchCharacter(c.characterId)}
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "accent-dot" : (isLight ? "bg-zinc-300 group-hover:bg-zinc-400" : "bg-zinc-600 group-hover:bg-zinc-500")}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{c.characterName || `Char ${c.characterId}`}</div>
                        </div>
                      </button>

                      <span className={`text-[10px] hidden sm:inline ${isLight ? "text-zinc-400" : "text-zinc-500"}`}>·{c.spells.length}</span>

                      <a
                        href={`https://www.dndbeyond.com/characters/${c.characterId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`h-6 w-6 grid place-items-center rounded-md shrink-0 ${isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
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
                        className={`h-6 w-6 grid place-items-center rounded-md text-[13px] shrink-0 ${isLight ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-red-500" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-300"}`}
                        onClick={(e) => { e.stopPropagation(); onRemoveCharacter(c.characterId); }}
                        aria-label={`Delete ${c.characterName || c.characterId}`}
                      >
                        ×
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className={`mt-2 pt-2 border-t space-y-1 ${isLight ? "border-zinc-200" : "border-zinc-700/60"}`}>
                        <div className={`text-[11px] ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Last fetch {fetchText}</div>
                        {modText ? <div className={`text-[11px] ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Sheet modified {modText}</div> : null}
                        <button
                          onClick={onRefreshClick}
                          disabled={isLinking}
                          className={`w-full mt-2 inline-flex items-center justify-center gap-1.5 border rounded-lg text-[12px] h-8 px-3 disabled:opacity-60 ${isLight ? "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "bg-zinc-700 border-zinc-600 text-zinc-100 hover:bg-zinc-600"}`}
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
            className={`mt-3 w-full text-[13px] px-3 py-2.5 rounded-lg border border-dashed transition-colors font-medium flex items-center justify-center gap-1.5 ${isLight ? "border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50" : "border-zinc-600 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700/50"}`}
          >
            <span className="text-[14px]">+</span> Add Character
          </button>

          <button
            onClick={() => setShowHelpConfig(true)}
            className={`mt-2 w-full text-[12px] px-3 py-2 rounded-lg border transition-colors font-medium flex items-center justify-center gap-1.5 ${isLight ? "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50" : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 hover:border-zinc-600"}`}
          >
            ⚙ Configure help
          </button>

          <div className={`mt-4 pt-4 border-t ${isLight ? "border-zinc-200" : "border-zinc-700/50"}`}>
            <h3 className={`text-[11px] uppercase tracking-widest font-semibold mb-2 px-1 ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>Theme</h3>
            <div className={`flex rounded-lg p-1 gap-1 ${isLight ? "bg-zinc-100" : "bg-zinc-900/60"}`}>
              {(["auto","light","dark"] as const).map(v=> {
                const active = theme.pref===v;
                return (
                  <button
                    key={v}
                    onClick={()=>theme.setPref(v)}
                    className={`flex-1 text-[11px] px-2 py-1.5 rounded-md font-medium capitalize transition-colors ${active ? (isLight ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" : "bg-zinc-700 text-zinc-100 shadow-sm") : (isLight ? "text-zinc-500 hover:text-zinc-700" : "text-zinc-400 hover:text-zinc-200")}`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`mt-4 pt-4 border-t ${isLight ? "border-zinc-200" : "border-zinc-700/50"}`}>
            <h3 className={`text-[11px] uppercase tracking-widest font-semibold mb-2 px-1 ${isLight ? "text-zinc-500" : "text-zinc-400"}`}>Cloud Backup</h3>
            {!backup.ui.backupEnabled ? (
              <>
                <button
                  onClick={() => backup.setUi((p: any) => ({ ...p, showEnableBackups: true }))}
                  className={`w-full text-[12px] px-3 py-2.5 rounded-lg border transition-colors font-medium flex items-center justify-center gap-1.5 ${isLight ? "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"}`}
                >
                  ☁️ Enable backups
                </button>
                <div className={`text-[10px] mt-1.5 px-1 leading-snug ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>
                  Encrypted with 6-digit PIN. We cannot see what we are storing. It is not perfect, but it is private.
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {backup.user.discord ? (
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${isLight ? "bg-zinc-50 border-zinc-200" : "bg-zinc-900/60 border-zinc-700/40"}`}>
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
                      <div className={`text-[12px] font-medium truncate ${isLight ? "text-zinc-800" : "text-zinc-200"}`}>{backup.user.discord.username || "Discord user"}</div>
                      <div className={`text-[10px] ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>Backup enabled</div>
                    </div>
                  </div>
                ) : (
                  <div className={`text-[11px] px-1 ${isLight ? "text-zinc-600" : "text-zinc-400"}`}>Backup enabled</div>
                )}

                <button
                  onClick={() => backup.onBackupAction("backup")}
                  className={`w-full text-[12px] px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 btn-accent`}
                >
                  ↑ Backup now
                </button>

                <button
                  onClick={() => backup.onBackupAction("restore")}
                  className={`w-full text-[12px] px-3 py-2 rounded-lg border transition-colors ${isLight ? "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "border-zinc-700 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"}`}
                >
                  ↓ Restore
                </button>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => backup.onDisable("delete")}
                    className={`flex-1 text-[11px] px-2 py-1.5 rounded-md ${isLight ? "bg-zinc-100 text-zinc-500 hover:text-red-600 hover:bg-zinc-200" : "bg-zinc-800 text-zinc-400 hover:text-red-300 hover:bg-zinc-700"}`}
                  >
                    Delete cloud
                  </button>
                  <button
                    onClick={() => backup.onDisable("disable")}
                    className={`flex-1 text-[11px] px-2 py-1.5 rounded-md ${isLight ? "bg-zinc-100 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"}`}
                  >
                    Disable
                  </button>
                </div>

                {backup.ui.lastCloudAction ? <div className={`text-[10px] px-1 ${isLight ? "text-zinc-500" : "text-zinc-500"}`}>{backup.ui.lastCloudAction}</div> : null}
                {backup.status ? <div className={`text-[10px] px-1 break-words text-accent-soft`}>{backup.status}</div> : null}
              </div>
            )}
            {!backup.ui.backupEnabled && backup.status ? <div className={`text-[10px] mt-2 px-1 break-words text-accent-soft`}>{backup.status}</div> : null}
          </div>
        </div>
      </div>

      <div className={`px-3 py-3 border-t text-[11px] ${isLight ? "border-zinc-200 text-zinc-500" : "border-zinc-700/70 text-zinc-500"}`}>
        <button
          onClick={() => setShowPrivacy(true)}
          className={`text-[11px] underline underline-offset-2 ${isLight ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          Privacy Policy
        </button>
        <div>
          <a href="/how-we-store" className={`text-[11px] underline underline-offset-2 ${isLight ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-400 hover:text-zinc-200"}`}>
            How we store your data
          </a>
        </div>
      </div>
    </aside>
  );
}
