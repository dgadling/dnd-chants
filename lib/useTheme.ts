"use client";
import { useCallback, useEffect, useState } from "react";

export type ThemePref = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE = "dnd-chant-theme-v1";

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
    } catch {}
  }, []);

  return { pref, actual, resolved: actual, setPref };
}
