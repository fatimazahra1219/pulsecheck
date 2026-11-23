"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { translations, type Language } from "./translations";

export type LanguageScope = "teacher" | "student";

export function useLanguage(scope: LanguageScope) {
  const storageKey = `pulsecheck-${scope}-language`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) {
          onStoreChange();
        }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener("pulsecheck-language-change", onStoreChange);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("pulsecheck-language-change", onStoreChange);
      };
    },
    [storageKey],
  );

  const getSnapshot = useCallback((): Language => {
    try {
      const savedLanguage = localStorage.getItem(storageKey);

      if (
        savedLanguage === "en" ||
        savedLanguage === "fr" ||
        savedLanguage === "ar"
      ) {
        return savedLanguage;
      }
    } catch {
      // Use English if browser storage is unavailable.
    }

    return "en";
  }, [storageKey]);

  const language = useSyncExternalStore<Language>(
    subscribe,
    getSnapshot,
    (): Language => "en",
  );

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      try {
        localStorage.setItem(storageKey, nextLanguage);
      } catch {
        // Continue if browser storage is unavailable.
      }

      window.dispatchEvent(new Event("pulsecheck-language-change"));
    },
    [storageKey],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  return {
    language,
    setLanguage,
    t: translations[language],
    dir: language === "ar" ? "rtl" : "ltr",
  };
}
