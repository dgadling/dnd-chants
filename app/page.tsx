"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS, SCHOOL_DEFAULTS, formatBox, parseBox } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { useTheme } from "@/lib/useTheme";
import { useCharacters } from "@/hooks/useCharacters";
import { useWelcome } from "@/hooks/useWelcome";
import { useBackup } from "@/lib/useBackup";
import { Drawer } from "@/components/Drawer";
import { SpellSection } from "@/components/SpellSection";
import { EnableBackupsDialog } from "@/components/EnableBackupsDialog";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const DEFAULT_HELP_TEMPLATE =
  "Help me come up with a short chant or idiom for the Dungeons & Dragons spell {spell} in {language} that would sound reasonable to a native speaker.";

function extractIdForDisplay(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/characters\/(\d{2,})/i);
  if (m) return m[1];
  const m2 = s.match(/(\d{5,})/);
  if (m2) return m2[1];
  return null;
}

export default function LabPage() {
  const theme = useTheme();
  const [filterText, setFilterText] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showHelpConfig, setShowHelpConfig] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  const {
    characters,
    activeId,
    activeCharacter,
    spellsArr,
    grouped,
    fetchCharacter,
    fetchCharacterInternal,
    onSwitch,
    isLinking,
    linkStatus,
    setLinkStatus,
  } = useCharacters();

  const filteredGrouped = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return grouped;
    const out: Record<string, typeof spellsArr> = {};
    for (const s of SCHOOLS) {
      const list = grouped[s] || [];
      out[s] = list.filter((sp: any) => sp.name.toLowerCase().includes(q));
    }
    return out;
  }, [grouped, filterText]);

  const hasFilter = filterText.trim().length > 0;

  const { showWelcome, closeWelcome, setShowWelcome } = useWelcome();

  const [extrasPerChar, setExtrasPerChar] = useState<Record<string, Record<string, { englishPhrase: string; box: string }>>>({});
  const [schoolLangsPerChar, setSchoolLangsPerChar] = useState<Record<string, Record<string, string>>>({});
  const [helpTemplate, setHelpTemplate] = useState<string>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.HELP_TEMPLATE) : null;
      if (raw && raw.trim()) return raw;
    } catch {}
    return DEFAULT_HELP_TEMPLATE;
  });

  // Load extras, schoolLangs, help
  useEffect(() => {
    try {
      const rawExtras = localStorage.getItem(STORAGE_KEYS.EXTRAS);
      if (rawExtras) {
        const parsed = JSON.parse(rawExtras);
        if (parsed && typeof parsed === "object") {
          const firstVal = Object.values(parsed)[0] as any;
          const isLegacyFlat = firstVal && typeof firstVal === "object" && "englishPhrase" in firstVal;
          if (isLegacyFlat) {
            const targetId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || characters[0]?.characterId;
            if (targetId) setExtrasPerChar({ [targetId]: parsed as any });
          } else {
            setExtrasPerChar(parsed as any);
          }
        }
      }
      const rawLangs = localStorage.getItem(STORAGE_KEYS.SCHOOL_LANGS);
      if (rawLangs) {
        const parsed = JSON.parse(rawLangs);
        if (parsed && typeof parsed === "object") {
          const firstVal = Object.values(parsed)[0];
          const isLegacyFlat = typeof firstVal === "string";
          if (isLegacyFlat) {
            const targetId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || characters[0]?.characterId;
            if (targetId) setSchoolLangsPerChar({ [targetId]: parsed as any });
          } else {
            setSchoolLangsPerChar(parsed as any);
          }
        }
      }
      const rawHelp = localStorage.getItem(STORAGE_KEYS.HELP_TEMPLATE);
      if (rawHelp && rawHelp.trim()) setHelpTemplate(rawHelp);
    } catch {}
  }, []); // eslint-disable-line

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.EXTRAS, JSON.stringify(extrasPerChar)); } catch {} }, [extrasPerChar]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.SCHOOL_LANGS, JSON.stringify(schoolLangsPerChar)); } catch {} }, [schoolLangsPerChar]);
  useEffect(() => { try { if (helpTemplate?.trim()) localStorage.setItem(STORAGE_KEYS.HELP_TEMPLATE, helpTemplate); } catch {} }, [helpTemplate]);

  const backup = useBackup({ characters, schoolLangsPerChar, extrasPerChar, activeId, helpTemplate });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (filterText) { setFilterText(""); return; }
      if (backup.ui.showEnableBackups) { backup.setUi((p: any) => ({ ...p, showEnableBackups: false })); return; }
      if (showWelcome) { closeWelcome(); return; }
      if (showPrivacy) { setShowPrivacy(false); return; }
      if (showHelpConfig) { setShowHelpConfig(false); return; }
      if (pendingDeleteId) { setPendingDeleteId(null); return; }
      if (showAddCharacter) { setShowAddCharacter(false); setLinkInput(""); setLinkStatus(""); return; }
      if (drawerOpen && window.innerWidth < 1024) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterText, backup.ui.showEnableBackups, showWelcome, showPrivacy, showHelpConfig, pendingDeleteId, showAddCharacter, drawerOpen, closeWelcome]);

  const onLinkClick = async () => {
    const id = extractIdForDisplay(linkInput);
    if (!id) { setLinkStatus("Enter D&D Beyond URL or numeric id"); return; }
    const result = await fetchCharacter(id);
    if (result) {
      setShowAddCharacter(false);
      setLinkInput("");
      setLinkStatus("");
    }
  };

  const onRefreshClick = () => {
    if (!activeCharacter?.characterId) return;
    void fetchCharacter(activeCharacter.characterId);
  };

  const onSwitchCharacter = (cid: string) => {
    onSwitch(cid);
    if (window.innerWidth < 1024) setDrawerOpen(false);
  };

  const onRemoveCharacter = (cid: string) => setPendingDeleteId(cid);

  const confirmRemoveCharacter = () => {
    const cid = pendingDeleteId;
    if (!cid) return;
    const idx = characters.findIndex((c: any) => c.characterId === cid);
    const newChars = characters.filter((c: any) => c.characterId !== cid);
    // useCharacters setter not exposed for removal, do via direct localStorage + reload logic
    try { localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(newChars)); } catch {}
    setExtrasPerChar((prev) => { const cp = { ...prev }; delete cp[cid]; return cp; });
    setSchoolLangsPerChar((prev) => { const cp = { ...prev }; delete cp[cid]; return cp; });
    if (activeId === cid) {
      if (newChars.length) {
        const next = newChars[Math.min(idx, newChars.length - 1)];
        try { localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, next.characterId); } catch {}
      } else {
        try { localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID); } catch {}
      }
      window.location.reload();
      return;
    }
    if (newChars.length === 0) { try { localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID); } catch {} }
    window.location.reload();
  };

  const totalVerbal = spellsArr.length;
  const hasChars = characters.length > 0;
  const activeExtras = activeId ? extrasPerChar[activeId] || {} : {};
  const activeLangs = activeId ? schoolLangsPerChar[activeId] || {} : {};
  const characterName = activeCharacter?.characterName || "";
  const lastFetchISO = activeCharacter?.lastFetchISO || "";
  const lastModifiedISO = activeCharacter?.lastModifiedISO || null;

  const handleSave = useCallback((spellName: string, englishPhrase: string, native: string, roman: string) => {
    if (!activeId) return;
    const box = formatBox(native, roman);
    setExtrasPerChar((prev) => ({
      ...prev,
      [activeId]: {
        ...(prev[activeId] || {}),
        [spellName]: { englishPhrase: englishPhrase.slice(0, 500), box: box.slice(0, 1100) },
      },
    }));
  }, [activeId]);

  // ESC clears filter if open, otherwise existing modal handling via global key handler below
  const clearFilter = useCallback(() => setFilterText(""), []);

  // Cmd-K / Ctrl-K focuses spell filter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("spell-filter-input") as HTMLInputElement | null;
        if (el) el.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen antialiased flex bg-app text-primary">
      {drawerOpen ? <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setDrawerOpen(false)} /> : null}

      <Drawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        characters={characters as any}
        activeId={activeId}
        hasChars={hasChars}
        onSwitchCharacter={onSwitchCharacter}
        onRemoveCharacter={onRemoveCharacter}
        setShowAddCharacter={setShowAddCharacter}
        setShowHelpConfig={setShowHelpConfig}
        setShowPrivacy={setShowPrivacy}
        lastFetchISO={lastFetchISO}
        lastModifiedISO={lastModifiedISO}
        isLinking={isLinking}
        onRefreshClick={onRefreshClick}
        backup={backup}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-3 py-3 border-b backdrop-blur border-default bg-surface/90">
          <button onClick={() => setDrawerOpen(true)} className="h-9 w-9 grid place-items-center rounded-lg bg-surface bg-surface-hover text-primary" aria-label="Open menu">
            <span className="flex flex-col justify-center" style={{ width: "18px", height: "14px", gap: "3px" }}>
              <span className="block rounded-full bg-current" style={{ width: "18px", height: "2px" }}></span>
              <span className="block rounded-full bg-current" style={{ width: "18px", height: "2px" }}></span>
              <span className="block rounded-full bg-current" style={{ width: "18px", height: "2px" }}></span>
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[15px] tracking-tight leading-none">🐉 D&D Chants</div>
            <div className="text-[11px] truncate mt-0.5 text-dim">
              {activeCharacter ? `${characterName || "Character"} • ${totalVerbal}` : "No character"}
            </div>
          </div>
        </div>

        <main className="flex-1 mx-auto w-full max-w-5xl px-3 py-4 lg:px-6 lg:py-6 pb-10">
          <header className="mb-4 hidden lg:block">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">🐉 D&D Chants</h1>
            <p className="mt-1 text-[13px] md:text-sm max-w-[34rem] leading-snug text-dim">
              {totalVerbal ? `${totalVerbal} spells grouped by school. ` : ""}Type a new English cue, hit ▶ to translate, 🔊 to hear it.
            </p>
          </header>

          {totalVerbal > 0 ? (
            <div className="sticky top-[52px] lg:top-0 z-10 -mx-3 lg:mx-0 px-3 lg:px-0 py-2 mb-3 backdrop-blur bg-app/80 border-b lg:border-0 border-default">
              <div className="relative max-w-[480px]">
                <input
                  id="spell-filter-input"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { if (filterText) setFilterText(""); else (e.target as HTMLInputElement).blur(); } }}
                  placeholder="Filter spells…"
                  className="w-full h-10 rounded-lg border pl-9 pr-9 text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim">⌕</span>
                {filterText ? (
                  <button onClick={clearFilter} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-dim bg-surface-hover hover:text-primary" aria-label="Clear filter">✕</button>
                ) : null}
              </div>
            </div>
          ) : null}

          {totalVerbal === 0 ? (
            !hasChars ? (
              <div className="rounded-xl border p-6 md:p-8 bg-surface border-default">
                <h2 className="text-[18px] font-semibold tracking-tight mb-1">Get started</h2>
                <p className="text-[13px] mb-6 max-w-[520px] text-dim">Link a character, pick a spell, write a cue. Everything saves locally.</p>
                <div className="flex gap-2">
                  <button onClick={() => { setDrawerOpen(true); setShowAddCharacter(true); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold btn-accent">+ Add Character</button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center space-y-3 rounded-xl border bg-surface border-default">
                <div className="text-lg font-semibold">No spells yet</div>
                <div className="text-sm max-w-[420px] mx-auto text-dim">Link your D&D Beyond character from the left drawer.</div>
              </div>
            )
          ) : hasFilter && SCHOOLS.every((s) => (filteredGrouped[s]?.length || 0) === 0) ? (
            <div className="rounded-xl border p-8 text-center bg-surface border-default">
              <div className="text-sm font-medium">No spells match “{filterText.trim()}”</div>
              <button onClick={clearFilter} className="mt-3 text-xs underline text-dim">Clear filter</button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {SCHOOLS.map((school) => {
                const spells = filteredGrouped[school] || [];
                // when filtering, hide empty schools; when not filtering, show all (even empty to keep flavor? hide empty when no filter if zero spells to reduce noise? show if has any spells normally)
                if (hasFilter && spells.length === 0) return null;
                if (!hasFilter && (grouped[school]?.length || 0) === 0 && spells.length === 0) {
                  // still show empty schools when no filter to keep flavor? hide to reduce noise — keep hidden when zero
                  return null;
                }
                const targetLang = activeLangs[school] || (SCHOOL_DEFAULTS[school as School] as string) || "en";
                return (
                  <SpellSection
                    key={school}
                    activeSchool={school as School}
                    activeSpells={spells as any}
                    activeTargetLang={targetLang}
                    activeId={activeId}
                    activeExtras={activeExtras as any}
                    setSchoolLangsPerChar={setSchoolLangsPerChar}
                    helpTemplate={helpTemplate}
                    handleSave={handleSave}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {showAddCharacter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddCharacter(false); setLinkInput(""); setLinkStatus(""); }} role="dialog" aria-modal="true">
          <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3 text-primary">Add Character</h3>
            <input className="w-full h-10 rounded-lg border px-3 text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus-ring-accent input-field" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://www.dndbeyond.com/characters/12345678 or 12345678" onKeyDown={(e) => { if (e.key === "Enter") onLinkClick(); }} autoFocus />
            <div className="flex gap-2 mt-3">
              <button onClick={onLinkClick} disabled={isLinking} className="flex-1 rounded-lg text-sm h-10 font-semibold disabled:opacity-60 btn-accent">{isLinking ? "Linking…" : characters.length ? "Add Character" : "Link Character"}</button>
              <button onClick={() => { setShowAddCharacter(false); setLinkInput(""); setLinkStatus(""); }} className="rounded-lg text-sm h-10 px-4 bg-surface bg-surface-hover text-dim">Cancel</button>
            </div>
            {linkStatus ? <div className="text-xs mt-2 text-accent-soft">{linkStatus}</div> : null}
          </div>
        </div>
      ) : null}

      {pendingDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default">
            <h3 className="text-sm font-semibold mb-2">Delete character?</h3>
            <p className="text-xs mb-4 text-dim">This will remove {characters.find((c: any) => c.characterId === pendingDeleteId)?.characterName || pendingDeleteId} and all saved chants.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingDeleteId(null)} className="rounded-lg text-xs h-8 px-4 bg-surface bg-surface-hover text-dim">Cancel</button>
              <button onClick={confirmRemoveCharacter} className="bg-red-600 text-white rounded-lg text-xs h-8 px-4 hover:bg-red-500 font-semibold">Delete</button>
            </div>
          </div>
        </div>
      ) : null}

      {showHelpConfig ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowHelpConfig(false)}>
          <div className="border rounded-xl p-5 max-w-md w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2 text-primary">Configure help</h3>
            <textarea className="w-full min-h-[96px] rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus-ring-accent resize-y input-field" rows={4} value={helpTemplate} onChange={(e) => setHelpTemplate(e.target.value)} />
            <div className="flex justify-between gap-2 mt-4">
              <button onClick={() => setHelpTemplate(DEFAULT_HELP_TEMPLATE)} className="rounded-lg text-xs h-8 px-4 bg-surface bg-surface-hover text-dim">Default</button>
              <button onClick={() => setShowHelpConfig(false)} className="rounded-lg text-xs h-8 px-4 font-semibold btn-accent">Done</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPrivacy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrivacy(false)}>
          <div className="border rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary">Privacy Policy</h3>
              <button onClick={() => setShowPrivacy(false)} className="h-7 w-7 grid place-items-center rounded-md bg-surface bg-surface-hover text-dim">✕</button>
            </div>
            <div className="space-y-3 text-[13px] leading-relaxed text-primary">
              <p>Everything you type and your characters are stored locally in your browser. We do not have accounts or servers storing your personal stuff, unless you enable cloud backups.</p>
              <p>Cloud Backup is optional and encrypted. Nobody can read it without your PIN.</p>
            </div>
            <div className="flex justify-end mt-5"><button onClick={() => setShowPrivacy(false)} className="rounded-lg text-xs h-8 px-4 font-semibold btn-accent">Done</button></div>
          </div>
        </div>
      ) : null}

      {backup.pinDialog?.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>backup.setPinDialog({open:false,mode:backup.pinDialog.mode})}>
          <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2 text-primary">{backup.pinDialog.mode==="backup"?"Enter PIN for backup":"Enter PIN to decrypt"}</h3>
            <input id="pin-dialog-input" type="password" inputMode="numeric" maxLength={6} placeholder="123456" className="w-full h-10 rounded-lg border px-3 text-sm tracking-widest focus:outline-none focus:ring-2 focus-ring-accent input-field" onKeyDown={e=>{ if(e.key==="Enter"){ const el=document.getElementById("pin-dialog-input") as HTMLInputElement; const v=el?.value||""; if(/^\d{6}$/.test(v)) backup.pinDialog.resolve?.(v); } if(e.key==="Escape") backup.pinDialog.resolve?.(null); }} />
            <div className="flex justify-between gap-2 mt-4"><button onClick={()=>backup.pinDialog.resolve?.(null)} className="rounded-lg text-xs h-8 px-4 bg-surface bg-surface-hover text-dim">Cancel</button><button onClick={()=>{ const el=document.getElementById("pin-dialog-input") as HTMLInputElement; const v=el?.value||""; if(/^\d{6}$/.test(v)) backup.pinDialog.resolve?.(v); }} className="rounded-lg text-xs h-8 px-4 font-semibold btn-accent">Confirm</button></div>
          </div>
        </div>
      ) : null}

      {backup.confirmRestore?.open && backup.confirmRestore.mode==="confirm-restore" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>backup.confirmRestore.resolve?.(false)}>
          <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2 text-primary">Found existing backup</h3>
            <p className="text-[13px] text-dim mb-4">Found existing cloud backup. Restore it to this device? This will replace local data.</p>
            <div className="flex justify-between gap-2"><button onClick={()=>backup.confirmRestore.resolve?.(false)} className="rounded-lg text-xs h-9 px-4 bg-surface border border-default text-primary bg-surface-hover">No, keep local</button><button onClick={()=>backup.confirmRestore.resolve?.(true)} className="rounded-lg text-xs h-9 px-4 font-semibold btn-accent">Yes, restore</button></div>
          </div>
        </div>
      ) : null}

      {showWelcome ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeWelcome} role="dialog" aria-modal="true">
          <div className="border rounded-xl p-6 max-w-md w-full shadow-2xl bg-surface border-default" onClick={e=>e.stopPropagation()}>
            <div className="h-8 w-8 rounded-lg grid place-items-center font-bold text-[14px] mb-3 bg-accent">🐉</div>
            <h3 className="text-[16px] font-semibold mb-2 text-primary">Your chants live here</h3>
            <p className="text-[13px] leading-relaxed mb-5 text-dim">Everything lives in this browser. No account needed. Cloud backup is optional and encrypted with a PIN only you know.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={()=>{ closeWelcome(); setDrawerOpen(true); setShowAddCharacter(true); }} className="flex-1 rounded-lg text-[13px] h-10 px-4 font-semibold btn-accent">Add my character</button>
              <button onClick={closeWelcome} className="flex-1 sm:flex-none rounded-lg text-[13px] h-10 px-4 bg-surface bg-surface-hover text-dim">Got it</button>
            </div>
          </div>
        </div>
      ) : null}

      <EnableBackupsDialog open={backup.ui.showEnableBackups} onClose={() => { backup.setUi((p: any) => ({ ...p, showEnableBackups: false })); }} onEnable={backup.onEnableBackups} isEnabling={backup.isBusy} discordClientId={(() => { try { return process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ""; } catch { return ""; } })()} />
    </div>
  );
}
