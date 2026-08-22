"use client";
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export function useWelcome() {
  const [showWelcome, setShowWelcome] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.WELCOME) !== "1") {
        setShowWelcome(true);
      }
    } catch {}
  }, []);

  const closeWelcome = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WELCOME, "1");
    } catch {}
    setShowWelcome(false);
  }, []);

  return { showWelcome, closeWelcome, setShowWelcome };
}
