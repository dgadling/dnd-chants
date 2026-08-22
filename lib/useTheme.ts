"use client";
import { useCallback, useEffect, useState } from "react";

export type ThemePref = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE = "dnd-chant-theme-v1";
const THEME_CHANGE_EVENT = "dnd-chant-theme-change";

function getSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

function resolve(pref: ThemePref): ResolvedTheme {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return getSystem();
}

function syncThemeColor(r: ResolvedTheme) {
  try {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = r === "light" ? "#fafaf9" : "#18181b";
  } catch {}
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>("auto");
  const [actual, setActual] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE) as ThemePref | null;
      if (raw === "light" || raw === "dark" || raw === "auto") {
        setPrefState(raw);
        const r = resolve(raw);
        setActual(r);
        document.documentElement.setAttribute("data-theme", r);
        syncThemeColor(r);
      } else {
        const sys = getSystem();
        setActual(sys);
        document.documentElement.setAttribute("data-theme", sys);
        syncThemeColor(sys);
      }
    } catch {
      const sys = getSystem();
      setActual(sys);
      try {
        document.documentElement.setAttribute("data-theme", sys);
        syncThemeColor(sys);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const r = resolve(pref);
    setActual(r);
    try {
      document.documentElement.setAttribute("data-theme", r);
      syncThemeColor(r);
    } catch {}
  }, [pref]);

  useEffect(() => {
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: ResolvedTheme = mq.matches ? "dark" : "light";
      setActual(r);
      try {
        document.documentElement.setAttribute("data-theme", r);
        syncThemeColor(r);
      } catch {}
    };
    try {
      mq.addEventListener("change", onChange);
    } catch {
      try {
        (mq as any).addListener(onChange);
      } catch {}
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        try {
          (mq as any).removeListener(onChange);
        } catch {}
      }
    };
  }, [pref]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE && e.newValue && (e.newValue === "light" || e.newValue === "dark" || e.newValue === "auto")) {
        const np = e.newValue as ThemePref;
        setPrefState((prev) => (prev === np ? prev : np));
      }
    };
    const onThemeChange = (e: Event) => {
      const ce = e as CustomEvent<ThemePref>;
      const np = ce.detail;
      if (np && (np === "light" || np === "dark" || np === "auto")) {
        setPrefState((prev) => (prev === np ? prev : np));
      }
    };
    try {
      window.addEventListener("storage", onStorage);
      window.addEventListener(THEME_CHANGE_EVENT, onThemeChange as EventListener);
    } catch {}
    return () => {
      try {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange as EventListener);
      } catch {}
    };
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(STORAGE, p);
    } catch {}
    const r = resolve(p);
    setActual(r);
    try {
      document.documentElement.setAttribute("data-theme", r);
      syncThemeColor(r);
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: p }));
    } catch {}
  }, []);

  return { pref, actual, resolved: actual, setPref };
}
