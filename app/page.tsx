"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCHOOLS, SCHOOL_DEFAULTS, formatBox } from "@/lib/lang";
import type { School } from "@/lib/lang";
import { useTheme } from "@/lib/useTheme";
import { useCharacters } from "@/hooks/useCharacters";
import { useWelcome } from "@/hooks/useWelcome";
import { useBackup } from "@/lib/useBackup";
import { Drawer } from "@/components/Drawer";
import { EnableBackupsDialog } from "@/components/EnableBackupsDialog";
import { SpellFilterBar } from "@/components/SpellFilterBar";
import { AddCharacterDialog } from "@/components/AddCharacterDialog";
import { HelpConfigDialog } from "@/components/HelpConfigDialog";
import { PrivacyDialog } from "@/components/PrivacyDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { PinDialog } from "@/components/PinDialog";
import { ConfirmRestoreDialog } from "@/components/ConfirmRestoreDialog";
import { PageHeader } from "@/components/PageHeader";
import { GetStarted, NoSpellsEmpty, NoMatchEmpty } from "@/components/EmptyStates";
import { SpellList } from "@/components/SpellList";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { MAX_ENGLISH_PHRASE_LEN, MAX_CHANT_BOX_LEN } from "@/lib/constants";
import { extractCharacterId as extractIdForDisplay } from "@/lib/extractCharacterId";

const DEFAULT_HELP_TEMPLATE =
  "Help me come up with a short chant or idiom for the Dungeons & Dragons spell {spell} in {language} that would sound reasonable to a native speaker.";

export default function LabPage() {
  useTheme();
  const [filterText, setFilterText] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showHelpConfig, setShowHelpConfig] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  const {
    characters,
    setCharacters,
    activeId,
    setActiveId,
    activeCharacter,
    spellsArr,
    grouped,
    fetchCharacter,
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

  const { showWelcome, closeWelcome } = useWelcome();

  const [extrasPerChar, setExtrasPerChar] = useState<Record<string, Record<string, { englishPhrase: string; box: string }>>>({});
  const [schoolLangsPerChar, setSchoolLangsPerChar] = useState<Record<string, Record<string, string>>>({});
  const [helpTemplate, setHelpTemplate] = useState<string>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.HELP_TEMPLATE) : null;
      if (raw && raw.trim()) return raw;
    } catch {}
    return DEFAULT_HELP_TEMPLATE;
  });

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("spell-filter-input") as HTMLInputElement | null;
        if (el) el.focus();
        return;
      }
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
  }, [filterText, backup, backup.ui.showEnableBackups, showWelcome, showPrivacy, showHelpConfig, pendingDeleteId, showAddCharacter, drawerOpen, closeWelcome, setLinkStatus]);

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
    setCharacters(newChars);
    setExtrasPerChar((prev) => { const cp = { ...prev }; delete cp[cid]; return cp; });
    setSchoolLangsPerChar((prev) => { const cp = { ...prev }; delete cp[cid]; return cp; });
    if (activeId === cid) {
      if (newChars.length) {
        const next = newChars[Math.min(idx, newChars.length - 1)];
        setActiveId(next.characterId);
      } else {
        setActiveId("");
        try { localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID); } catch {}
      }
    } else if (newChars.length === 0) {
      try { localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID); } catch {}
    }
    setPendingDeleteId(null);
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
        [spellName]: { englishPhrase: englishPhrase.slice(0, MAX_ENGLISH_PHRASE_LEN), box: box.slice(0, MAX_CHANT_BOX_LEN) },
      },
    }));
  }, [activeId]);

  const clearFilter = useCallback(() => setFilterText(""), []);

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
          <PageHeader totalVerbal={totalVerbal} />

          {totalVerbal > 0 && (
            <div className="sticky top-[52px] lg:top-0 z-10 -mx-3 lg:mx-0 px-3 lg:px-0 py-2 mb-3 backdrop-blur bg-app/80 border-b lg:border-0 border-default">
              <SpellFilterBar filterText={filterText} setFilterText={setFilterText} clearFilter={clearFilter} />
            </div>
          )}

          {(() => {
            const noMatch = hasFilter && SCHOOLS.every((s) => (filteredGrouped[s]?.length || 0) === 0);
            if (totalVerbal === 0) {
              return hasChars ? <NoSpellsEmpty /> : <GetStarted onAddCharacter={() => { setDrawerOpen(true); setShowAddCharacter(true); }} />;
            }
            if (noMatch) return <NoMatchEmpty filterText={filterText} clearFilter={clearFilter} />;
            return (
              <SpellList
                filteredGrouped={filteredGrouped}
                grouped={grouped}
                hasFilter={hasFilter}
                activeId={activeId}
                activeLangs={activeLangs}
                activeExtras={activeExtras}
                setSchoolLangsPerChar={setSchoolLangsPerChar}
                helpTemplate={helpTemplate}
                handleSave={handleSave}
              />
            );
          })()}
        </main>
      </div>

      <AddCharacterDialog
        open={showAddCharacter}
        linkInput={linkInput}
        setLinkInput={setLinkInput}
        linkStatus={linkStatus}
        isLinking={isLinking}
        onLinkClick={onLinkClick}
        onClose={() => { setShowAddCharacter(false); setLinkInput(""); setLinkStatus(""); }}
        charactersCount={characters.length}
      />

      <DeleteConfirmDialog
        pendingDeleteId={pendingDeleteId}
        characterName={characters.find((c: any) => c.characterId === pendingDeleteId)?.characterName}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmRemoveCharacter}
      />

      <HelpConfigDialog
        open={showHelpConfig}
        onClose={() => setShowHelpConfig(false)}
        helpTemplate={helpTemplate}
        setHelpTemplate={setHelpTemplate}
        defaultTemplate={DEFAULT_HELP_TEMPLATE}
      />

      <PrivacyDialog open={showPrivacy} onClose={() => setShowPrivacy(false)} />

      <PinDialog
        open={!!backup.pinDialog?.open}
        mode={backup.pinDialog?.mode || "backup"}
        onCancel={() => backup.pinDialog.resolve?.(null)}
        onConfirm={(v) => backup.pinDialog.resolve?.(v)}
      />

      <ConfirmRestoreDialog
        open={!!(backup.confirmRestore?.open && backup.confirmRestore.mode==="confirm-restore")}
        onNo={() => backup.confirmRestore.resolve?.(false)}
        onYes={() => backup.confirmRestore.resolve?.(true)}
      />

      <WelcomeDialog
        open={!!showWelcome}
        onClose={closeWelcome}
        onAddCharacter={() => { closeWelcome(); setDrawerOpen(true); setShowAddCharacter(true); }}
      />

      <EnableBackupsDialog open={backup.ui.showEnableBackups} onClose={() => { backup.setUi((p: any) => ({ ...p, showEnableBackups: false })); }} onEnable={backup.onEnableBackups} isEnabling={backup.isBusy} discordClientId={(() => { try { return process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ""; } catch { return ""; } })()} />
    </div>
  );
}
