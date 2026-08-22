"use client";
import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      if (typeof window === "undefined") return initial;
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

export function useLocalStorageString(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      if (typeof window === "undefined") return initial;
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return raw;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      if (value) localStorage.setItem(key, value);
      else if (value === "" && key.includes("active")) {
        // allow removal for active id
      }
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
